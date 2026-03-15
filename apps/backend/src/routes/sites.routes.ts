import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

/** Get sites for a customer */
router.get('/customer/:customerId', authenticate, async (req, res, next) => {
  try {
    const sites = await prisma.site.findMany({
      where: { customerId: req.params.customerId },
      include: {
        electricityBills: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        _count: { select: { quotations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sites);
  } catch (err) { next(err); }
});

/** Get single site with bills */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: {
        electricityBills: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
        customer: { select: { id: true, name: true } },
      },
    });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (err) { next(err); }
});

/** Create site */
router.post(
  '/',
  authenticate,
  [
    body('customerId').trim().notEmpty().withMessage('customerId required'),
    body('address').trim().notEmpty().withMessage('address required'),
    body('name').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('pincode').optional().trim(),
    body('roofType').optional().isIn(['FLAT', 'SLOPED', 'METAL', 'TERRACE', 'GROUND_MOUNTED']),
    body('roofAreaSqM').optional().isFloat({ min: 0 }),
    body('orientation').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const customer = await prisma.customer.findUnique({ where: { id: req.body.customerId } });
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      const site = await prisma.site.create({
        data: req.body,
        include: { customer: { select: { id: true, name: true } } },
      });
      res.status(201).json(site);
    } catch (err) { next(err); }
  }
);

/** Update site */
router.put(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.site.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Site not found' });
      const { customerId: _c, ...data } = req.body;
      const site = await prisma.site.update({ where: { id: req.params.id }, data });
      res.json(site);
    } catch (err) { next(err); }
  }
);

export default router;
