import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import * as authService from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Role } from '@prisma/client';

const router = Router();

router.post(
  '/login',
  [
    body('emailOrUserId').trim().notEmpty().withMessage('Email or User ID required'),
    body('password').notEmpty().withMessage('Password required'),
    body('rememberMe').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await authService.login({
        emailOrUserId: req.body.emailOrUserId,
        password: req.body.password,
        rememberMe: req.body.rememberMe === true,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof Error && (err.message === 'Invalid credentials' || err.message.startsWith('Account is disabled'))) {
        return res.status(401).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('userId').optional().trim(),
    body('phone').optional().trim(),
    body('designation').optional().trim(),
    body('role').optional().isIn(['ADMIN', 'SALES', 'FINANCE']).withMessage('Invalid role'),
  ],
  authenticate,
  requireRoles(Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'Email already registered') {
        return res.status(409).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await authService.getMe(req.user.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
