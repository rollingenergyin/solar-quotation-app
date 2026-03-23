import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import formulaRoutes from './formula.routes.js';
import ocrRoutes from './ocr.routes.js';
import billsRoutes from './bills.routes.js';
import materialsRoutes from './materials.routes.js';
import auditRoutes from './audit.routes.js';
import customersRoutes from './customers.routes.js';
import sitesRoutes from './sites.routes.js';
import quotationsRoutes from './quotations.routes.js';
import templatesRoutes from './templates.routes.js';
import paramsRoutes from './params.routes.js';
import financeRoutes from './finance.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/formulas', formulaRoutes);
router.use('/ocr', ocrRoutes);
router.use('/bills', billsRoutes);
router.use('/materials', materialsRoutes);
router.use('/audit', auditRoutes);
router.use('/customers', customersRoutes);
router.use('/sites', sitesRoutes);
router.use('/quotations', quotationsRoutes);
router.use('/templates', templatesRoutes);
router.use('/params', paramsRoutes);
router.use('/finance', financeRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
