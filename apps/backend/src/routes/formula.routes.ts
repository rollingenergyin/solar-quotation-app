import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import * as formulaService from '../services/formula.service.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Role } from '@prisma/client';

const router = Router();

/** Get supported pricing units (authenticated) */
router.get('/units', authenticate, async (_req: Request, res: Response) => {
  res.json({
    units: formulaService.PRICING_UNITS,
    computeFormula: 'quantity * unitPrice for all unit types',
  });
});

/** List all active formulas (authenticated) */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const formulas = await formulaService.listFormulas();
    res.json(formulas);
  } catch (err) {
    next(err);
  }
});

/** Get formula by slug with all versions */
router.get(
  '/:slug',
  authenticate,
  param('slug').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const formula = await formulaService.getFormulaBySlug(req.params.slug);
      res.json(formula);
    } catch (err) {
      if (err instanceof Error && err.message === 'Formula not found') {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  }
);

/** Evaluate formula by slug (authenticated) */
router.post(
  '/:slug/evaluate',
  authenticate,
  param('slug').trim().notEmpty(),
  body('variables').isObject().withMessage('variables must be an object'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const variables = req.body.variables as Record<string, number>;
      const result = await formulaService.evaluateFormula(req.params.slug, variables);
      res.json({ result });
    } catch (err) {
      if (err instanceof Error && err.message === 'Formula not found') {
        return res.status(404).json({ error: err.message });
      }
      if (err instanceof Error && err.message.includes('Formula')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

/** Validate expression without saving (admin) */
router.post(
  '/validate',
  authenticate,
  requireRoles(Role.ADMIN),
  body('expression').trim().notEmpty().withMessage('expression required'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const validation = formulaService.validateExpression(req.body.expression);
      res.json(validation);
    } catch (err) {
      next(err);
    }
  }
);

/** Create new formula (admin) */
router.post(
  '/',
  authenticate,
  requireRoles(Role.ADMIN),
  [
    body('name').trim().notEmpty().withMessage('name required'),
    body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('slug: lowercase letters, numbers, hyphens'),
    body('expression').trim().notEmpty().withMessage('expression required'),
    body('variables').isArray().withMessage('variables must be an array'),
    body('variables.*').isString().withMessage('each variable must be a string'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const formula = await formulaService.createFormula({
        ...req.body,
        createdById: req.user.userId,
      });
      res.status(201).json(formula);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Formula')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

/** Update formula metadata (admin) */
router.put(
  '/:id',
  authenticate,
  requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('isActive').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, description, isActive } = req.body;
      const formula = await formulaService.updateFormula(req.params.id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      });
      res.json(formula);
    } catch (err) {
      next(err);
    }
  }
);

/** Create new formula version (admin) - version control */
router.post(
  '/:id/versions',
  authenticate,
  requireRoles(Role.ADMIN),
  param('id').trim().notEmpty(),
  [
    body('expression').trim().notEmpty().withMessage('expression required'),
    body('variables').isArray().withMessage('variables must be an array'),
    body('description').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const version = await formulaService.createFormulaVersion({
        formulaId: req.params.id,
        expression: req.body.expression,
        variables: req.body.variables,
        description: req.body.description,
        createdById: req.user.userId,
      });
      res.status(201).json(version);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Formula')) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  }
);

/** Set active formula version (admin) */
router.patch(
  '/:formulaId/versions/:versionId/activate',
  authenticate,
  requireRoles(Role.ADMIN),
  param('formulaId').trim().notEmpty(),
  param('versionId').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await formulaService.setActiveVersion(req.params.formulaId, req.params.versionId);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === 'Version not found') {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  }
);

export default router;
