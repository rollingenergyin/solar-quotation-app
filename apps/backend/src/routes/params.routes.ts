import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient, Role } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const router = Router();
const prisma = new PrismaClient();

/** List all system parameters */
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const params = await prisma.systemParam.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    res.json(params);
  } catch (err) {
    next(err);
  }
});

/** Update a system parameter value by key (admin only) */
router.put(
  '/:key',
  authenticate,
  requireRoles(Role.ADMIN),
  param('key').trim().notEmpty().withMessage('key required'),
  body('value').isFloat().withMessage('value must be a number'),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const updated = await prisma.systemParam.update({
        where: { key: req.params.key },
        data: { value: parseFloat(req.body.value) },
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Record to update not found')) {
        return res.status(404).json({ error: 'Parameter not found' });
      }
      next(err);
    }
  }
);

export default router;
