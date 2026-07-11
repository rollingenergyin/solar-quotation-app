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
import attendanceRoutes from './attendance.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import crmRoutes from './crm.routes.js';
import automationRoutes from './automation.routes.js';
import messageTemplatesRoutes from './message-templates.routes.js';
import campaignsRoutes from './campaigns.routes.js';
import socialRoutes from './social.routes.js';
import siteCostingRoutes from './site-costing.routes.js';

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
router.use('/site-costing', siteCostingRoutes);
router.use('/templates', templatesRoutes);
router.use('/params', paramsRoutes);
router.use('/finance', financeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/crm', crmRoutes);
router.use('/automation', automationRoutes);
router.use('/crm-templates', messageTemplatesRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/social', socialRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
