import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { logAudit } from '../services/audit.service.js';
import { Role } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ─── Categories ──────────────────────────────────────────────────────────────

router.get('/categories', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cats = await prisma.materialCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(cats);
  } catch (err) { next(err); }
});

router.post(
  '/categories',
  authenticate, requireRoles(Role.ADMIN),
  [body('name').trim().notEmpty(), body('slug').trim().matches(/^[a-z0-9-]+$/), body('sortOrder').optional().isInt()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const cat = await prisma.materialCategory.create({ data: req.body });
      await logAudit({ userId: req.user!.userId, action: 'CREATE', entity: 'category', entityId: cat.id, after: cat as unknown as Record<string, unknown> });
      res.status(201).json(cat);
    } catch (err) { next(err); }
  }
);

// ─── Materials ────────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, isActive, search } = req.query;
    const materials = await prisma.material.findMany({
      where: {
        ...(categoryId && { categoryId: String(categoryId) }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(search && { name: { contains: String(search), mode: 'insensitive' } }),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    res.json(materials);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        weeklyPrices: { orderBy: { effectiveFrom: 'desc' }, take: 10 },
      },
    });
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (err) { next(err); }
});

router.post(
  '/',
  authenticate, requireRoles(Role.ADMIN),
  [
    body('categoryId').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('brand').optional().trim(),
    body('model').optional().trim(),
    body('specs').optional().isObject(),
    body('unit').optional().isIn(['WATT', 'PIECE', 'METER', 'KW', 'SET']),
    body('basePrice').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const material = await prisma.material.create({
        data: req.body,
        include: { category: { select: { id: true, name: true } } },
      });
      await logAudit({ userId: req.user!.userId, action: 'CREATE', entity: 'material', entityId: material.id, after: material as unknown as Record<string, unknown> });
      res.status(201).json(material);
    } catch (err) { next(err); }
  }
);

router.put(
  '/:id',
  authenticate, requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  [
    body('name').optional().trim().notEmpty(),
    body('brand').optional().trim(),
    body('model').optional().trim(),
    body('specs').optional().isObject(),
    body('unit').optional().isIn(['WATT', 'PIECE', 'METER', 'KW', 'SET']),
    body('basePrice').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const before = await prisma.material.findUnique({ where: { id: req.params.id } });
      if (!before) return res.status(404).json({ error: 'Material not found' });
      const { categoryId: _c, ...updateData } = req.body;
      const material = await prisma.material.update({ where: { id: req.params.id }, data: updateData, include: { category: true } });
      await logAudit({ userId: req.user!.userId, action: 'UPDATE', entity: 'material', entityId: material.id, before: before as unknown as Record<string, unknown>, after: material as unknown as Record<string, unknown> });
      res.json(material);
    } catch (err) { next(err); }
  }
);

router.delete(
  '/:id',
  authenticate, requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await prisma.material.findUnique({ where: { id: req.params.id } });
      if (!before) return res.status(404).json({ error: 'Material not found' });
      await prisma.material.update({ where: { id: req.params.id }, data: { isActive: false } });
      await logAudit({ userId: req.user!.userId, action: 'DELETE', entity: 'material', entityId: req.params.id, before: before as unknown as Record<string, unknown> });
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

// ─── Weekly Pricing ───────────────────────────────────────────────────────────

router.get('/:id/prices', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prices = await prisma.weeklyPrice.findMany({
      where: { materialId: req.params.id },
      orderBy: { effectiveFrom: 'desc' },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    res.json(prices);
  } catch (err) { next(err); }
});

router.post(
  '/:id/prices',
  authenticate, requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  [
    body('pricePerUnit').isFloat({ min: 0 }).withMessage('pricePerUnit required'),
    body('effectiveFrom').isISO8601().withMessage('effectiveFrom must be ISO date'),
    body('effectiveTo').optional().isISO8601(),
    body('notes').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const material = await prisma.material.findUnique({ where: { id: req.params.id } });
      if (!material) return res.status(404).json({ error: 'Material not found' });
      const price = await prisma.weeklyPrice.create({
        data: {
          materialId: req.params.id,
          pricePerUnit: req.body.pricePerUnit,
          effectiveFrom: new Date(req.body.effectiveFrom),
          effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : undefined,
          notes: req.body.notes,
          createdById: req.user!.userId,
        },
        include: { createdBy: { select: { name: true, email: true } } },
      });
      await prisma.material.update({ where: { id: req.params.id }, data: { basePrice: req.body.pricePerUnit } });
      await logAudit({ userId: req.user!.userId, action: 'CREATE', entity: 'weekly_price', entityId: price.id, after: price as unknown as Record<string, unknown> });
      res.status(201).json(price);
    } catch (err) { next(err); }
  }
);

export default router;
