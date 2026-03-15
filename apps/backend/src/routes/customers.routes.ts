import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

/** List all customers (with site + bill counts) */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query;
    const customers = await prisma.customer.findMany({
      where: search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : undefined,
      include: {
        _count: { select: { sites: true, quotations: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(customers);
  } catch (err) { next(err); }
});

/** Get single customer with sites */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        sites: {
          include: {
            _count: { select: { electricityBills: true, quotations: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        quotations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) { next(err); }
});

/** Create customer */
router.post(
  '/',
  authenticate,
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Invalid email'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('city').optional({ checkFalsy: true }).trim(),
    body('state').optional({ checkFalsy: true }).trim(),
    body('pincode').optional({ checkFalsy: true }).trim(),
    body('company').optional({ checkFalsy: true }).trim(),
    body('gstin').optional({ checkFalsy: true }).trim(),
    body('notes').optional({ checkFalsy: true }).trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const customer = await prisma.customer.create({
        data: { ...req.body, createdById: req.user!.userId },
        include: { createdBy: { select: { name: true } } },
      });
      res.status(201).json(customer);
    } catch (err) { next(err); }
  }
);

/** Update customer */
router.put(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Customer not found' });
      const { createdById: _x, ...data } = req.body;
      const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
      res.json(customer);
    } catch (err) { next(err); }
  }
);

/** Delete customer */
router.delete(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { quotations: true, sites: true } } },
      });
      if (!existing) return res.status(404).json({ error: 'Customer not found' });
      if (existing._count.quotations > 0) {
        return res.status(400).json({
          error: 'Cannot delete customer with quotations. Delete or reassign quotations first.',
        });
      }
      await prisma.customer.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) { next(err); }
  }
);

export default router;
