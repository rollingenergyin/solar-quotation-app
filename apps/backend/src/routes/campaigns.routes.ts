import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient, CampaignType, CampaignStatus } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { launchBroadcast, enrollLeadInDrip, stopPaymentFollowups } from '../services/crm/campaign-engine.service.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/campaigns
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type } = req.query;
    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(status ? { status: status as CampaignStatus } : {}),
        ...(type ? { type: type as CampaignType } : {}),
      },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
  } catch (err) { next(err); }
});

// POST /api/campaigns
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, channel, targetFilter, templateId, scheduledAt, steps } = req.body;
    if (!name || !type || !channel) return res.status(400).json({ error: 'name, type, channel required' });

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type: type as CampaignType,
        channel,
        targetFilter: targetFilter ?? {},
        templateId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        createdBy: req.user!.userId,
        steps: type === 'DRIP' && steps
          ? { create: (steps as { delayDays: number; templateId: string }[]).map((s, i) => ({ stepNumber: i + 1, delayDays: s.delayDays, templateId: s.templateId })) }
          : undefined,
      },
      include: { steps: true },
    });
    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

// POST /api/campaigns/:id/launch
router.post('/:id/launch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: req.params.id } });
    if (campaign.type === CampaignType.BROADCAST) {
      launchBroadcast(campaign.id).catch((e) => console.error('[Campaign launch]', e));
      res.json({ success: true, message: 'Broadcast launched in background' });
    } else {
      res.status(400).json({ error: 'Only BROADCAST campaigns can be manually launched. DRIP auto-runs via drip tick.' });
    }
  } catch (err) { next(err); }
});

// POST /api/campaigns/:id/enroll — enroll a specific lead in a drip
router.post('/:id/enroll', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId required' });
    await enrollLeadInDrip(req.params.id, leadId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/campaigns/stop-payment-followup — stop all payment follow-ups for a lead
router.post('/stop-payment-followup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ error: 'leadId required' });
    await stopPaymentFollowups(leadId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [campaign, enrollmentStats] = await Promise.all([
      prisma.campaign.findUniqueOrThrow({ where: { id: req.params.id } }),
      prisma.campaignEnrollment.groupBy({
        by: ['status'],
        where: { campaignId: req.params.id },
        _count: { id: true },
      }),
    ]);
    res.json({
      campaign,
      enrollments: enrollmentStats.map((e) => ({ status: e.status, count: e._count.id })),
    });
  } catch (err) { next(err); }
});

export default router;
