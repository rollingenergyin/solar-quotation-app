import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient, CrmStage, LeadSource, LeadLanguage } from '@prisma/client';
import { createHash } from 'crypto';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { transitionStage, emitLeadEvent } from '../services/crm/lead-state-machine.service.js';
import { recalculateScore } from '../services/crm/lead-scorer.service.js';
import { emitEvent } from '../services/crm/event-bus.service.js';
import { ingestBuffer } from '../services/crm/sheet-ingestion.service.js';
import { getRealTimeStats } from '../services/crm/analytics.service.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Helpers ──────────────────────────────────────────────────────────────────

function phoneHash(phone: string) {
  return createHash('md5').update(phone.replace(/\D/g, '')).digest('hex');
}

// ─── Leads CRUD ───────────────────────────────────────────────────────────────

// GET /api/crm/leads
router.get('/leads', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage, source, language, assignedTo, search, scoreMin, scoreMax, page = '1', limit = '50' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (stage) where['stage'] = stage;
    if (source) where['source'] = source;
    if (language) where['language'] = language;
    if (assignedTo) where['assignedToId'] = assignedTo;
    if (scoreMin || scoreMax) {
      where['score'] = {};
      if (scoreMin) (where['score'] as Record<string, number>)['gte'] = Number(scoreMin);
      if (scoreMax) (where['score'] as Record<string, number>)['lte'] = Number(scoreMax);
    }
    if (search) {
      where['OR'] = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search) } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { city: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [leads, total] = await Promise.all([
      prisma.crmLead.findMany({
        where: where as any,
        include: {
          assignedTo: { select: { id: true, name: true } },
          score_record: true,
          _count: { select: { events: true, conversations: true } },
        },
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: Number(limit),
      }),
      prisma.crmLead.count({ where: where as any }),
    ]);

    res.json({ leads, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) { next(err); }
});

// GET /api/crm/leads/:id
router.get('/leads/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        score_record: true,
        events: { orderBy: { createdAt: 'desc' }, take: 50 },
        conversations: {
          include: { messages: { orderBy: { sentAt: 'desc' }, take: 20 } },
        },
        campaignEnrollments: {
          include: { campaign: { select: { id: true, name: true, type: true, status: true } } },
        },
      },
    });
    res.json(lead);
  } catch (err) { next(err); }
});

// POST /api/crm/leads — create lead
router.post('/leads', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, city, state, systemKw, language, source, assignedToId, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

    const normalizedPhone = String(phone).replace(/\D/g, '');
    const hash = phoneHash(normalizedPhone);

    const lead = await prisma.crmLead.upsert({
      where: { phoneHash: hash },
      create: {
        name,
        phone: normalizedPhone,
        phoneHash: hash,
        email,
        city,
        state,
        systemKw: systemKw ? Number(systemKw) : undefined,
        language: (language as LeadLanguage) ?? LeadLanguage.EN,
        source: (source as LeadSource) ?? LeadSource.MANUAL,
        assignedToId,
        notes,
      },
      update: { name, email, city, state, notes },
    });

    const eventId = await emitLeadEvent(prisma, lead.id, 'LEAD_CREATED', req.user!.userId, { source });
    await recalculateScore(prisma, lead.id);
    await emitEvent({ event: 'lead.created', leadId: lead.id, eventId, payload: { source }, ts: Date.now() });

    res.status(201).json(lead);
  } catch (err) { next(err); }
});

// PATCH /api/crm/leads/:id — update fields
router.patch('/leads/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'email', 'city', 'state', 'systemKw', 'language', 'assignedToId', 'notes', 'metadata'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    const lead = await prisma.crmLead.update({ where: { id: req.params.id }, data });
    await recalculateScore(prisma, lead.id);

    res.json(lead);
  } catch (err) { next(err); }
});

// PATCH /api/crm/leads/:id/stage — state machine transition
router.patch('/leads/:id/stage', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage, reason } = req.body;
    if (!stage) return res.status(400).json({ error: 'stage is required' });

    const result = await transitionStage(
      prisma,
      req.params.id,
      stage as CrmStage,
      req.user!.userId,
      { reason }
    );

    if (!result.success) return res.status(400).json({ error: result.error });

    await emitEvent({
      event: 'lead.stage_changed',
      leadId: req.params.id,
      eventId: result.eventId!,
      payload: { toStage: stage, reason },
      ts: Date.now(),
    });

    res.json({ success: true, eventId: result.eventId });
  } catch (err) { next(err); }
});

// GET /api/crm/leads/:id/events — full event timeline
router.get('/leads/:id/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.crmLeadEvent.findMany({
      where: { leadId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(events);
  } catch (err) { next(err); }
});

// POST /api/crm/leads/:id/message — send a one-off message
router.post('/leads/:id/message', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, templateId, rawContent, language } = req.body;
    const { dispatchMessage } = await import('../services/crm/communication/message-dispatcher.service.js');
    const lead = await prisma.crmLead.findUniqueOrThrow({ where: { id: req.params.id } });

    await dispatchMessage({
      leadId: lead.id,
      channel: channel ?? 'whatsapp',
      templateId,
      language: (language as LeadLanguage) ?? lead.language,
      variables: { name: lead.name, phone: lead.phone },
      rawContent,
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/crm/leads/stats/funnel
router.get('/stats/funnel', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stageCounts = await prisma.crmLead.groupBy({
      by: ['stage'],
      _count: { id: true },
    });
    res.json(stageCounts.map((s) => ({ stage: s.stage, count: s._count.id })));
  } catch (err) { next(err); }
});

// GET /api/crm/analytics
router.get('/analytics', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getRealTimeStats();
    res.json(stats);
  } catch (err) { next(err); }
});

// ── WhatsApp Webhook ─────────────────────────────────────────────────────────

// GET /api/crm/webhook/whatsapp — Meta verification
router.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST /api/crm/webhook/whatsapp — incoming messages
router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages?.[0]) {
      const msg = value.messages[0];
      const from = msg.from; // phone number
      const text = msg.text?.body ?? msg.type;

      // Find or create lead by phone
      const hash = phoneHash(from);
      let lead = await prisma.crmLead.findUnique({ where: { phoneHash: hash } });

      if (!lead) {
        const contactName = value.contacts?.[0]?.profile?.name ?? 'Unknown';
        lead = await prisma.crmLead.create({
          data: {
            name: contactName,
            phone: from,
            phoneHash: hash,
            source: LeadSource.WHATSAPP,
            language: LeadLanguage.EN,
          },
        });
        const eventId = await emitLeadEvent(prisma, lead.id, 'LEAD_CREATED', 'whatsapp_webhook', {});
        await emitEvent({ event: 'lead.created', leadId: lead.id, eventId, payload: { source: 'whatsapp' }, ts: Date.now() });
      }

      // Store message in conversation
      const conversation = await prisma.crmConversation.upsert({
        where: { leadId_channel: { leadId: lead.id, channel: 'whatsapp' } },
        create: { leadId: lead.id, channel: 'whatsapp', lastMessageAt: new Date() },
        update: { lastMessageAt: new Date() },
      });

      await prisma.crmMessage.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          channel: 'whatsapp',
          content: text,
          externalId: msg.id,
          metadata: { type: msg.type },
        },
      });

      const eventId = await emitLeadEvent(prisma, lead.id, 'MESSAGE_RECEIVED', 'whatsapp_webhook', { text, msgId: msg.id });
      await emitEvent({ event: 'lead.message_received', leadId: lead.id, eventId, payload: { channel: 'whatsapp', text }, ts: Date.now() });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[WhatsApp Webhook]', err);
    res.sendStatus(200); // Always 200 to Meta
  }
});

// ── Sheet Import ──────────────────────────────────────────────────────────────

// POST /api/crm/import/sheet
router.post('/import/sheet', authenticate, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await ingestBuffer(req.file.buffer, req.file.originalname, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/crm/import/:id — import status
router.get('/import/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await prisma.sheetImport.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json(record);
  } catch (err) { next(err); }
});

export default router;
