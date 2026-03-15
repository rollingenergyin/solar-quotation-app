import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Role } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/** List sales users (admin only) */
router.get(
  '/',
  authenticate,
  requireRoles(Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        where: { role: 'SALES' },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          status: true,
          createdAt: true,
          _count: { select: { quotations: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json(users.map((u) => ({
        ...u,
        quotationsCount: u._count.quotations,
        _count: undefined,
      })));
    } catch (err) {
      next(err);
    }
  }
);

/** Create sales user (admin only) */
router.post(
  '/',
  authenticate,
  requireRoles(Role.ADMIN),
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('userId').trim().notEmpty().withMessage('User ID required'),
    body('phone').optional().trim(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('designation').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errArray = errors.array();
        return res.status(400).json({ error: errArray[0]?.msg ?? 'Validation failed', errors: errArray });
      }

      const { name, email, userId, phone, password, designation } = req.body;
      const trimmedUserId = String(userId).trim();
      const emailVal = (email ?? '').toString().trim().toLowerCase();

      const existingEmail = await prisma.user.findUnique({ where: { email: emailVal } });
      if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

      const existingUserId = await prisma.user.findUnique({ where: { userId: trimmedUserId } });
      if (existingUserId) return res.status(409).json({ error: 'User ID already taken' });

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: emailVal,
          userId: trimmedUserId,
          phone: phone?.trim() || null,
          designation: designation?.trim() || null,
          password: hashedPassword,
          role: Role.SALES,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          status: true,
          createdAt: true,
        },
      });
      res.status(201).json(user);
    } catch (err) {
      console.error('[Create user] Error:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        const prismaErr = err as { code?: string; meta?: { target?: string[] } };
        if (prismaErr.code === 'P2002') {
          const target = prismaErr.meta?.target?.[0];
          const msg = target === 'email' ? 'Email already registered' : target === 'userId' ? 'User ID already taken' : 'User already exists';
          return res.status(409).json({ error: msg });
        }
      }
      next(err);
    }
  }
);

/** Get current user profile (includes quotations count) - must be before /:id */
router.get('/me/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { quotations: true } },
      },
    });
    if (!profile) return res.status(404).json({ error: 'User not found' });
    const { _count, ...rest } = profile;
    res.json({ ...rest, quotationsCount: _count.quotations });
  } catch (err) {
    next(err);
  }
});

/** Change own password - must be before /:id */
router.post(
  '/me/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const valid = await bcrypt.compare(req.body.currentPassword, user.password);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

      const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/** Get single user (admin or self) */
router.get(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === 'ADMIN';
      const isSelf = req.params.id === req.user!.userId;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          role: true,
          status: true,
          createdAt: true,
          _count: { select: { quotations: true } },
        },
      });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { _count, ...rest } = user;
      res.json({ ...rest, quotationsCount: _count.quotations });
    } catch (err) {
      next(err);
    }
  }
);

/** Update user (admin or self for limited fields) */
router.put(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('userId').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    body('designation').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const isAdmin = req.user!.role === 'ADMIN';
      const targetId = req.params.id;
      const isSelf = targetId === req.user!.userId;

      const existing = await prisma.user.findUnique({ where: { id: targetId } });
      if (!existing) return res.status(404).json({ error: 'User not found' });

      const data: Record<string, unknown> = {};

      if (isAdmin) {
        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.email !== undefined) {
          const dup = await prisma.user.findUnique({ where: { email: req.body.email } });
          if (dup && dup.id !== targetId) return res.status(409).json({ error: 'Email already in use' });
          data.email = req.body.email;
        }
        if (req.body.userId !== undefined) {
          const dup = await prisma.user.findUnique({ where: { userId: req.body.userId } });
          if (dup && dup.id !== targetId) return res.status(409).json({ error: 'User ID already in use' });
          data.userId = req.body.userId;
        }
        if (req.body.phone !== undefined) data.phone = req.body.phone || null;
        if (req.body.designation !== undefined) data.designation = req.body.designation || null;
      } else if (isSelf) {
        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.phone !== undefined) data.phone = req.body.phone || null;
        if (req.body.designation !== undefined) data.designation = req.body.designation || null;
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const user = await prisma.user.update({
        where: { id: targetId },
        data,
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
          designation: true,
          status: true,
        },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

/** Toggle user status - disable/enable (admin only) */
router.patch(
  '/:id/status',
  authenticate,
  requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  body('status').isIn(['ACTIVE', 'DISABLED']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.role === 'ADMIN') return res.status(400).json({ error: 'Cannot disable admin' });

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { status: req.body.status },
        select: { id: true, status: true },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/** Reset password (admin only) */
router.post(
  '/:id/reset-password',
  authenticate,
  requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({
        where: { id: req.params.id },
        data: { password: hashedPassword },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
