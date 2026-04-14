import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { generateDynamicMessage } from '../services/crm/multilingual.service.js';
import { LeadLanguage } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/templates/crm
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, channel } = req.query;
    const templates = await prisma.messageTemplate.findMany({
      where: {
        ...(category ? { category: String(category) } : {}),
        ...(channel ? { channel: String(channel) } : {}),
        isActive: true,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
  } catch (err) { next(err); }
});

// POST /api/templates/crm
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, channel, contentEn, contentHi, contentMr, variables } = req.body;
    if (!name || !category || !channel || !contentEn) {
      return res.status(400).json({ error: 'name, category, channel, contentEn are required' });
    }
    const tmpl = await prisma.messageTemplate.create({
      data: { name, category, channel, contentEn, contentHi, contentMr, variables: variables ?? [] },
    });
    res.status(201).json(tmpl);
  } catch (err) { next(err); }
});

// PATCH /api/templates/crm/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'category', 'channel', 'contentEn', 'contentHi', 'contentMr', 'variables', 'isActive'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    const tmpl = await prisma.messageTemplate.update({ where: { id: req.params.id }, data });
    res.json(tmpl);
  } catch (err) { next(err); }
});

// DELETE /api/templates/crm/:id
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.messageTemplate.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/templates/crm/preview — generate AI content preview
router.post('/preview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intent, language, variables } = req.body;
    const content = await generateDynamicMessage({
      intent,
      language: (language as LeadLanguage) ?? LeadLanguage.EN,
      variables: variables ?? {},
    });
    res.json({ content });
  } catch (err) { next(err); }
});

export default router;
