import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

/** List all bills for a site, ordered by year/month */
router.get(
  '/:siteId',
  authenticate,
  param('siteId').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site = await prisma.site.findUnique({ where: { id: req.params.siteId } });
      if (!site) return res.status(404).json({ error: 'Site not found' });

      const bills = await prisma.electricityBill.findMany({
        where: { siteId: req.params.siteId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
      res.json(bills);
    } catch (err) {
      next(err);
    }
  }
);

/** Create a single bill entry manually */
router.post(
  '/',
  authenticate,
  [
    body('siteId').trim().notEmpty().withMessage('siteId required'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1–12'),
    body('year').isInt({ min: 2000, max: 2100 }).withMessage('year must be 2000–2100'),
    body('unitsKwh').isFloat({ min: 0 }).withMessage('unitsKwh must be >= 0'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be >= 0'),
    body('billImageUrl').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { siteId, month, year, unitsKwh, amount, billImageUrl } = req.body;

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) return res.status(404).json({ error: 'Site not found' });

      const bill = await prisma.electricityBill.upsert({
        where: { siteId_month_year: { siteId, month, year } },
        update: { unitsKwh, ...(amount !== undefined && { amount }), source: 'MANUAL' },
        create: {
          siteId,
          month,
          year,
          unitsKwh,
          ...(amount !== undefined && { amount }),
          ...(billImageUrl && { billImageUrl }),
          source: 'MANUAL',
        },
      });

      res.status(201).json(bill);
    } catch (err) {
      next(err);
    }
  }
);

/** Bulk create/update bills for a site (paste 12 months at once) */
router.post(
  '/bulk',
  authenticate,
  [
    body('siteId').trim().notEmpty().withMessage('siteId required'),
    body('bills').isArray({ min: 1 }).withMessage('bills must be a non-empty array'),
    body('bills.*.month').isInt({ min: 1, max: 12 }),
    body('bills.*.year').isInt({ min: 2000, max: 2100 }),
    body('bills.*.unitsKwh').isFloat({ min: 0 }),
    body('bills.*.amount').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { siteId, bills } = req.body;

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) return res.status(404).json({ error: 'Site not found' });

      const saved = await Promise.all(
        bills.map((b: { month: number; year: number; unitsKwh: number; amount?: number }) =>
          prisma.electricityBill.upsert({
            where: { siteId_month_year: { siteId, month: b.month, year: b.year } },
            update: { unitsKwh: b.unitsKwh, ...(b.amount !== undefined && { amount: b.amount }), source: 'MANUAL' },
            create: {
              siteId,
              month: b.month,
              year: b.year,
              unitsKwh: b.unitsKwh,
              ...(b.amount !== undefined && { amount: b.amount }),
              source: 'MANUAL',
            },
          })
        )
      );

      res.status(201).json({ saved, count: saved.length });
    } catch (err) {
      next(err);
    }
  }
);

/** Update a bill entry */
router.patch(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  [
    body('unitsKwh').optional().isFloat({ min: 0 }),
    body('amount').optional().isFloat({ min: 0 }),
    body('billImageUrl').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const existing = await prisma.electricityBill.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Bill not found' });

      const { unitsKwh, amount, billImageUrl } = req.body;
      const bill = await prisma.electricityBill.update({
        where: { id: req.params.id },
        data: {
          ...(unitsKwh !== undefined && { unitsKwh }),
          ...(amount !== undefined && { amount }),
          ...(billImageUrl !== undefined && { billImageUrl }),
          source: 'MANUAL',
        },
      });

      res.json(bill);
    } catch (err) {
      next(err);
    }
  }
);

/** Delete a bill entry */
router.delete(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.electricityBill.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Bill not found' });

      await prisma.electricityBill.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
