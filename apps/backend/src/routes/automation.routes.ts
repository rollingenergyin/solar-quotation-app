import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/automation/rules
router.get('/rules', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.automationRule.findMany({
      include: { _count: { select: { executions: true } } },
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }],
    });
    res.json(rules);
  } catch (err) { next(err); }
});

// POST /api/automation/rules
router.post('/rules', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, trigger, conditions, actions, loopGuard, priority } = req.body;
    if (!name || !trigger || !actions) {
      return res.status(400).json({ error: 'name, trigger, actions are required' });
    }
    const rule = await prisma.automationRule.create({
      data: { name, description, trigger, conditions: conditions ?? [], actions, loopGuard: loopGuard ?? 1, priority: priority ?? 0 },
    });
    res.status(201).json(rule);
  } catch (err) { next(err); }
});

// PATCH /api/automation/rules/:id
router.patch('/rules/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'description', 'trigger', 'conditions', 'actions', 'loopGuard', 'priority', 'isActive'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    const rule = await prisma.automationRule.update({ where: { id: req.params.id }, data });
    res.json(rule);
  } catch (err) { next(err); }
});

// DELETE /api/automation/rules/:id
router.delete('/rules/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.automationRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/automation/executions — recent execution log
router.get('/executions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ruleId, leadId, status } = req.query;
    const executions = await prisma.automationExecution.findMany({
      where: {
        ...(ruleId ? { ruleId: String(ruleId) } : {}),
        ...(leadId ? { leadId: String(leadId) } : {}),
        ...(status ? { status: String(status) } : {}),
      },
      include: { rule: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(executions);
  } catch (err) { next(err); }
});

export default router;
