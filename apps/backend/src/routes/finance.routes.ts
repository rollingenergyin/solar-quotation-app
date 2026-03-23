import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { requireFinanceAccess } from '../middleware/finance-access.js';
import { bankStatementService } from '../services/bank-statement.service.js';
import { getProjectCostingSummary, getProjectsSummary } from '../services/project-costing.service.js';
import * as financeAuthService from '../services/finance-auth.service.js';

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

type Period = 'daily' | 'monthly' | 'yearly';

function getDateRange(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'yearly':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }
  return { start, end };
}

// ─── Finance Auth (no global middleware) ─────────────────────────────────────
router.post(
  '/auth/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('rememberMe').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const result = await financeAuthService.financeLogin(
        req.body.email,
        req.body.password,
        req.body.rememberMe === true
      );
      res.json(result);
    } catch (err) {
      if (err instanceof Error && (err.message === 'Invalid credentials' || err.message.startsWith('Account is disabled') || err.message.startsWith('Access denied'))) {
        return res.status(401).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.get('/auth/me', authenticate, requireFinanceAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, userId: true, email: true, name: true, role: true, status: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// All other finance routes require ADMIN or FINANCE
router.use(authenticate, requireFinanceAccess);

// ─── Dashboard ─────────────────────────────────────────────────────────────
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as Period) || 'monthly';
    const projectId = (req.query.projectId as string)?.trim();
    const { start, end } = getDateRange(period);

    const where = { createdAt: { gte: start, lte: end } };
    const projectWhere = projectId ? { projectId } : {};

    const [siteExpenses, commercialExpenses, siteEarnings, commercialEarnings] = await Promise.all([
      prisma.expense.aggregate({
        where: { ...where, ...projectWhere, category: 'SITE_EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { ...where, ...projectWhere, category: 'COMMERCIAL_EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        where: { ...where, ...projectWhere, category: 'Site Earnings' },
        _sum: { amount: true },
      }),
      prisma.income.aggregate({
        where: { ...where, ...projectWhere, category: 'Commercial Earnings' },
        _sum: { amount: true },
      }),
    ]);

    const totalExpenses = (siteExpenses._sum.amount ?? 0) + (commercialExpenses._sum.amount ?? 0);
    const totalRevenue = (siteEarnings._sum.amount ?? 0) + (commercialEarnings._sum.amount ?? 0);

    const [inflows, outflows] = await Promise.all([
      prisma.income.aggregate({ where, _sum: { amount: true } }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    const inflowsSum = inflows._sum.amount ?? 0;
    const outflowsSum = outflows._sum.amount ?? 0;

    const latestSnapshot = await prisma.cashflowSnapshot.findFirst({
      orderBy: { date: 'desc' },
    });

    res.json({
      statementSummary: {
        siteExpenses: siteExpenses._sum.amount ?? 0,
        commercialExpenses: commercialExpenses._sum.amount ?? 0,
        siteEarnings: siteEarnings._sum.amount ?? 0,
        commercialEarnings: commercialEarnings._sum.amount ?? 0,
      },
      metrics: {
        totalRevenue,
        totalExpenses,
        grossProfit: totalRevenue - totalExpenses,
        netProfit: totalRevenue - totalExpenses,
      },
      cashflow: {
        openingBalance: latestSnapshot?.openingBalance ?? 0,
        inflows: inflowsSum,
        outflows: outflowsSum,
        closingBalance: (latestSnapshot?.closingBalance ?? 0) + inflowsSum - outflowsSum,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isPrisma = err && typeof err === 'object' && 'code' in err;
    console.error('FINANCE DASHBOARD ERROR:', err);

    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: isDev ? message : 'Failed to fetch dashboard',
      ...(isDev && isPrisma ? { code: (err as { code?: string }).code } : {}),
    });
  }
});

// ─── Vendors ───────────────────────────────────────────────────────────────
router.get('/vendors', async (_req: Request, res: Response) => {
  try {
    const vendors = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
    res.json(vendors);
  } catch (err) {
    console.error('FINANCE VENDORS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

router.post('/vendors', async (req: Request, res: Response) => {
  try {
    const { name, gstin, contact, address } = req.body;
    const vendor = await prisma.vendor.create({ data: { name, gstin, contact, address } });
    res.status(201).json(vendor);
  } catch (err) {
    console.error('FINANCE VENDOR CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.get('/vendors/:id', async (req: Request, res: Response) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
    });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    console.error('FINANCE VENDOR GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

router.put('/vendors/:id', async (req: Request, res: Response) => {
  try {
    const { name, gstin, contact, address } = req.body;
    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { name, gstin, contact, address },
    });
    res.json(vendor);
  } catch (err) {
    console.error('FINANCE VENDOR UPDATE ERROR:', err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', async (req: Request, res: Response) => {
  try {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE VENDOR DELETE ERROR:', err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

// ─── Clients ──────────────────────────────────────────────────────────────
router.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.financeClient.findMany({ orderBy: { name: 'asc' } });
    res.json(clients);
  } catch (err) {
    console.error('FINANCE CLIENTS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.post('/clients', async (req: Request, res: Response) => {
  try {
    const { name, gstin, contact, address, customerId } = req.body;
    const client = await prisma.financeClient.create({
      data: { name, gstin, contact, address, customerId },
    });
    res.status(201).json(client);
  } catch (err) {
    console.error('FINANCE CLIENT CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.get('/clients/:id', async (req: Request, res: Response) => {
  try {
    const client = await prisma.financeClient.findUnique({
      where: { id: req.params.id },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    console.error('FINANCE CLIENT GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

router.put('/clients/:id', async (req: Request, res: Response) => {
  try {
    const { name, gstin, contact, address, customerId } = req.body;
    const client = await prisma.financeClient.update({
      where: { id: req.params.id },
      data: { name, gstin, contact, address, customerId },
    });
    res.json(client);
  } catch (err) {
    console.error('FINANCE CLIENT UPDATE ERROR:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/clients/:id', async (req: Request, res: Response) => {
  try {
    await prisma.financeClient.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE CLIENT DELETE ERROR:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2003') {
      return res.status(400).json({ error: 'Cannot delete: client has invoices or sales bills. Remove them first.' });
    }
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// ─── Sites (under Client) ──────────────────────────────────────────────────
router.get('/sites', async (req: Request, res: Response) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const where = clientId ? { clientId } : {};
    const sites = await prisma.financeSite.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(sites);
  } catch (err) {
    console.error('FINANCE SITES LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

router.post('/sites', async (req: Request, res: Response) => {
  try {
    const { name, address, clientId } = req.body;
    if (!clientId?.trim()) return res.status(400).json({ error: 'clientId required' });

    // Verify client exists before creating site
    const client = await prisma.financeClient.findUnique({
      where: { id: clientId.trim() },
      select: { id: true },
    });
    if (!client) {
      return res.status(400).json({ error: 'Client not found. Please select a valid client.' });
    }

    const site = await prisma.financeSite.create({
      data: {
        name: name?.trim() || 'Unnamed Site',
        address: address?.trim() || null,
        clientId: clientId.trim(),
      },
      include: { client: { select: { id: true, name: true } } },
    });
    res.status(201).json(site);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    console.error('FINANCE SITE CREATE ERROR:', err);

    if (code === 'P2025' || code === 'P2003') {
      return res.status(400).json({ error: 'Client not found. Please select a valid client.' });
    }
    if (code === 'P2010') {
      return res.status(500).json({ error: 'Database schema may be out of sync. Run: npx prisma db push' });
    }

    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: isDev ? msg : 'Failed to create site',
      ...(isDev && code ? { code } : {}),
    });
  }
});

router.get('/sites/:id', async (req: Request, res: Response) => {
  try {
    const site = await prisma.financeSite.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json(site);
  } catch (err) {
    console.error('FINANCE SITE GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

router.put('/sites/:id', async (req: Request, res: Response) => {
  try {
    const { name, address, clientId } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name?.trim() || 'Unnamed Site';
    if (address !== undefined) data.address = address?.trim() || null;
    if (clientId !== undefined) data.clientId = clientId.trim();
    const site = await prisma.financeSite.update({
      where: { id: req.params.id },
      data,
      include: { client: { select: { id: true, name: true } } },
    });
    res.json(site);
  } catch (err) {
    console.error('FINANCE SITE UPDATE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to update site' });
  }
});

router.delete('/sites/:id', async (req: Request, res: Response) => {
  try {
    await prisma.financeSite.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE SITE DELETE ERROR:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2025') return res.status(404).json({ error: 'Site not found' });
    if (code === 'P2003') {
      return res.status(400).json({ error: 'Cannot delete: site has linked records that prevent removal.' });
    }
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ─── Expenses ──────────────────────────────────────────────────────────────
router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as Period | undefined;
    const category = req.query.category as string | undefined;
    const where: Record<string, unknown> = {};
    if (period) {
      const { start, end } = getDateRange(period);
      where.createdAt = { gte: start, lte: end };
    }
    if (category) where.category = category;

    const expenses = await prisma.expense.findMany({
      where,
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    console.error('FINANCE EXPENSES LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const { amount, category, siteId, vendorId, paymentMode, description, billUrl, multiSite, projectId } = req.body;
    const expense = await prisma.expense.create({
      data: {
        amount: Number(amount),
        category,
        siteId: siteId || null,
        projectId: projectId || null,
        vendorId: vendorId || null,
        paymentMode: paymentMode || null,
        description: description || null,
        billUrl: billUrl || null,
        multiSite: Boolean(multiSite),
      },
      include: { vendor: true },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error('FINANCE EXPENSE CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// ─── Incomes ───────────────────────────────────────────────────────────────
router.get('/incomes', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as Period | undefined;
    const where: Record<string, unknown> = {};
    if (period) {
      const { start, end } = getDateRange(period);
      where.createdAt = { gte: start, lte: end };
    }

    const incomes = await prisma.income.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(incomes);
  } catch (err) {
    console.error('FINANCE INCOMES LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch incomes' });
  }
});

router.post('/incomes', async (req: Request, res: Response) => {
  try {
    const { amount, category, siteId, clientId, paymentMode, description, projectId } = req.body;
    const income = await prisma.income.create({
      data: {
        amount: Number(amount),
        category: category || null,
        siteId: siteId || null,
        clientId: clientId || null,
        paymentMode: paymentMode || null,
        description: description || null,
        projectId: projectId || null,
      },
    });
    res.status(201).json(income);
  } catch (err) {
    console.error('FINANCE INCOME CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create income' });
  }
});

// ─── Bank Statement Upload & Transactions ───────────────────────────────────
router.post('/bank-upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ error: 'No file uploaded' });

    const result = await bankStatementService.uploadAndProcess(
      file.buffer,
      file.originalname,
      file.mimetype
    );
    res.status(201).json(result);
  } catch (err) {
    console.error('FINANCE BANK UPLOAD ERROR:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to process upload' });
  }
});

router.get('/bank-transactions', async (req: Request, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string | undefined;
    const type = req.query.type as 'INCOME' | 'EXPENSE' | undefined;
    const category = req.query.category as string | undefined;
    const categories = req.query.categories as string | undefined;  // comma-separated, include only these
    const excludeCategories = req.query.excludeCategories as string | undefined;  // comma-separated, hide these
    const siteId = req.query.siteId as string | undefined;
    const uncategorizedOnly = req.query.uncategorized === 'true';
    const sortDate = (req.query.sortDate as 'asc' | 'desc') || 'desc';
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    const categoriesArr = categories ? categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const excludeCategoriesArr = excludeCategories ? excludeCategories.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

    const { transactions, total } = await bankStatementService.getTransactions({
      uploadId,
      type,
      category: !categoriesArr?.length && !excludeCategoriesArr?.length && category ? (uncategorizedOnly ? null : (category as Parameters<typeof bankStatementService.getTransactions>[0]['category'])) : undefined,
      categories: categoriesArr,
      excludeCategories: excludeCategoriesArr,
      uncategorizedOnly,
      siteId,
      sortDate: sortDate === 'asc' ? 'asc' : 'desc',
      from: isNaN(from?.getTime() ?? 1) ? undefined : from,
      to: isNaN(to?.getTime() ?? 1) ? undefined : to,
      limit,
      offset,
    });

    res.json({ transactions, total });
  } catch (err) {
    console.error('FINANCE BANK TRANSACTIONS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.patch('/bank-transactions/bulk', async (req: Request, res: Response) => {
  try {
    const { ids, category, categoryId, siteId, isReviewed } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const result = await bankStatementService.bulkUpdate(ids, {
      categoryId: categoryId ?? category ?? undefined,
      siteId: siteId !== undefined ? siteId : undefined,
      isReviewed,
    });
    res.json(result);
  } catch (err) {
    console.error('FINANCE BULK UPDATE ERROR:', err);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

router.get('/bank-transactions/summary', async (req: Request, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string | undefined;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;

    const where: Parameters<typeof prisma.bankTransaction.aggregate>[0]['where'] = { duplicateOfId: null };
    if (uploadId) where.uploadId = uploadId;
    if (fromStr || toStr) {
      where.transactionDate = {};
      if (fromStr) (where.transactionDate as { gte?: Date }).gte = new Date(fromStr);
      if (toStr) (where.transactionDate as { lte?: Date }).lte = new Date(toStr);
    }

    const [byCategory, uncategorizedCount, totalIncome, totalExpense] = await Promise.all([
      prisma.bankTransaction.groupBy({
        by: ['categoryId'],
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.bankTransaction.count({ where: { ...where, categoryId: null } }),
      prisma.bankTransaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.bankTransaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);

    const catIds = [...new Set(byCategory.map((r) => r.categoryId).filter(Boolean))] as string[];
    const cats = catIds.length ? await prisma.transactionCategory.findMany({ where: { id: { in: catIds } } }) : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    const byCategoryMap: Record<string, number> = {};
    for (const r of byCategory) {
      const key = r.categoryId ? (catMap[r.categoryId] ?? r.categoryId) : 'UNCATEGORIZED';
      byCategoryMap[key] = (byCategoryMap[key] ?? 0) + (r._sum.amount ?? 0);
    }

    res.json({
      byCategory: byCategoryMap,
      uncategorizedCount,
      totalIncome: totalIncome._sum.amount ?? 0,
      totalExpense: totalExpense._sum.amount ?? 0,
    });
  } catch (err) {
    console.error('FINANCE TRANSACTIONS SUMMARY ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/bank-uploads', async (_req: Request, res: Response) => {
  try {
    const uploads = await prisma.bankStatementUpload.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { transactions: true } } },
    });
    res.json(uploads);
  } catch (err) {
    console.error('FINANCE BANK UPLOADS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch uploads' });
  }
});

router.delete('/bank-uploads/:id', async (req: Request, res: Response) => {
  try {
    await prisma.bankStatementUpload.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE BANK UPLOAD DELETE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2025') {
      return res.status(404).json({ error: 'Upload not found' });
    }
    res.status(500).json({ error: 'Failed to delete upload' });
  }
});

router.patch('/bank-transactions/:id', async (req: Request, res: Response) => {
  try {
    const allowed = ['type', 'category', 'categoryId', 'partyName', 'description', 'referenceNo', 'siteId', 'isReviewed', 'manualOverride'];
    const update = Object.fromEntries(
      allowed.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]])
    );
    const transaction = await bankStatementService.updateClassification(req.params.id, update);
    res.json(transaction);
  } catch (err) {
    console.error('FINANCE BANK TRANSACTION UPDATE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.status(500).json({ error: 'Failed to update classification' });
  }
});

// ─── Transaction Categories (user-manageable) ─────────────────────────────
router.get('/transaction-categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.transactionCategory.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    console.error('FINANCE TRANSACTION CATEGORIES ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/transaction-categories', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const category = await prisma.transactionCategory.create({
      data: { name: name.trim() },
    });
    res.status(201).json(category);
  } catch (err) {
    console.error('FINANCE TRANSACTION CATEGORY CREATE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/transaction-categories/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const category = await prisma.transactionCategory.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    });
    res.json(category);
  } catch (err) {
    console.error('FINANCE TRANSACTION CATEGORY UPDATE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err) {
      if ((err as { code?: string }).code === 'P2025') return res.status(404).json({ error: 'Category not found' });
      if ((err as { code?: string }).code === 'P2002') return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ─── Transaction Rules ───────────────────────────────────────────────────
router.get('/transaction-rules', async (_req: Request, res: Response) => {
  try {
    const rules = await prisma.transactionRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { site: true },
    });
    res.json(rules);
  } catch (err) {
    console.error('FINANCE TRANSACTION RULES LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

router.post('/transaction-rules', async (req: Request, res: Response) => {
  try {
    const { name, priority, conditions, category, siteId, isActive } = req.body;
    const rule = await prisma.transactionRule.create({
      data: {
        name: name ?? null,
        priority: Number(priority) ?? 0,
        conditions: conditions ?? {},
        category: category ?? null,
        siteId: siteId ?? null,
        isActive: isActive !== false,
      },
      include: { site: true },
    });
    res.status(201).json(rule);
  } catch (err) {
    console.error('FINANCE TRANSACTION RULE CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.put('/transaction-rules/:id', async (req: Request, res: Response) => {
  try {
    const { name, priority, conditions, category, siteId, isActive } = req.body;
    const rule = await prisma.transactionRule.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name ?? null }),
        ...(priority !== undefined && { priority: Number(priority) ?? 0 }),
        ...(conditions !== undefined && { conditions }),
        ...(category !== undefined && { category: category ?? null }),
        ...(siteId !== undefined && { siteId: siteId ?? null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { site: true },
    });
    res.json(rule);
  } catch (err) {
    console.error('FINANCE TRANSACTION RULE UPDATE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/transaction-rules/:id', async (req: Request, res: Response) => {
  try {
    await prisma.transactionRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE TRANSACTION RULE DELETE ERROR:', err);
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2025') {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// ─── Transaction Splits ───────────────────────────────────────────────────
router.get('/bank-transactions/:id/splits', async (req: Request, res: Response) => {
  try {
    const splits = await prisma.transactionSplit.findMany({
      where: { transactionId: req.params.id },
      include: { site: true, category: true },
    });
    res.json(splits);
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLITS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch splits' });
  }
});

router.post('/bank-transactions/:id/splits', async (req: Request, res: Response) => {
  try {
    const { splits } = req.body as { splits: { categoryId: string; siteId?: string; amount: number; description?: string }[] };
    if (!Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'splits array required' });
    }
    const txn = await prisma.bankTransaction.findUnique({
      where: { id: req.params.id },
      select: { amount: true, id: true },
    });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const totalSplit = splits.reduce((s, sp) => s + sp.amount, 0);
    if (Math.abs(totalSplit - txn.amount) > 0.01) {
      return res.status(400).json({ error: 'Split amounts must sum to transaction amount' });
    }

    await prisma.transactionSplit.deleteMany({ where: { transactionId: req.params.id } });

    const created = await prisma.$transaction(
      splits.map((sp) =>
        prisma.transactionSplit.create({
          data: {
            transactionId: req.params.id,
            categoryId: sp.categoryId,
            siteId: sp.siteId ?? null,
            amount: Number(sp.amount),
            description: sp.description ?? null,
          },
          include: { site: true, category: true },
        })
      )
    );

    await prisma.bankTransaction.update({
      where: { id: req.params.id },
      data: { isSplit: true, categoryId: null },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLIT CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create splits' });
  }
});

router.delete('/bank-transactions/:id/splits', async (req: Request, res: Response) => {
  try {
    await prisma.transactionSplit.deleteMany({ where: { transactionId: req.params.id } });
    await prisma.bankTransaction.update({
      where: { id: req.params.id },
      data: { isSplit: false },
    });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLITS DELETE ERROR:', err);
    res.status(500).json({ error: 'Failed to delete splits' });
  }
});

// ─── Cash Vouchers ─────────────────────────────────────────────────────────
router.get('/cash-vouchers', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as Period | undefined;
    const where: Record<string, unknown> = {};
    if (period) {
      const { start, end } = getDateRange(period);
      where.createdAt = { gte: start, lte: end };
    }
    const vouchers = await prisma.cashVoucher.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(vouchers);
  } catch (err) {
    console.error('FINANCE CASH VOUCHERS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});

router.post('/cash-vouchers', async (req: Request, res: Response) => {
  try {
    const { amount, description, category, paymentSource, billUrl } = req.body;
    const voucher = await prisma.cashVoucher.create({
      data: { amount: Number(amount), description, category, paymentSource, billUrl },
    });
    res.status(201).json(voucher);
  } catch (err) {
    console.error('FINANCE CASH VOUCHER CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create voucher' });
  }
});

// ─── Products ──────────────────────────────────────────────────────────────
router.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await prisma.financeProduct.findMany({ orderBy: { name: 'asc' } });
    const withStock = await Promise.all(
      products.map(async (p) => {
        const movs = await prisma.stockMovement.aggregate({
          where: { productId: p.id },
          _sum: { quantity: true },
        });
        return { ...p, remainingQty: movs._sum.quantity ?? 0 };
      })
    );
    res.json(withStock);
  } catch (err) {
    console.error('FINANCE PRODUCTS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/products', async (req: Request, res: Response) => {
  try {
    const { name, hsn, type } = req.body;
    const product = await prisma.financeProduct.create({
      data: { name, hsn: hsn || null, type: type || 'SPGS' },
    });
    res.status(201).json(product);
  } catch (err) {
    console.error('FINANCE PRODUCT CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ─── Stock Movements ───────────────────────────────────────────────────────
router.get('/stock-movements', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const productId = req.query.productId as string | undefined;
    const type = req.query.type as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const movements = await prisma.stockMovement.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(movements);
  } catch (err) {
    console.error('FINANCE STOCK MOVEMENTS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

router.post('/stock-movements', async (req: Request, res: Response) => {
  try {
    const { productId, projectId, siteId, quantity, unitPrice, type } = req.body;
    const movement = await prisma.stockMovement.create({
      data: {
        productId,
        projectId: projectId || null,
        siteId: siteId || null,
        quantity: Number(quantity),
        unitPrice: unitPrice != null ? Number(unitPrice) : null,
        type: type || 'PURCHASE',
      },
      include: { product: true },
    });
    res.status(201).json(movement);
  } catch (err) {
    console.error('FINANCE STOCK MOVEMENT CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create stock movement' });
  }
});

// ─── Projects & Costing ─────────────────────────────────────────────────────
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = await prisma.financeProject.findMany({
      include: { financeSite: { include: { client: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(projects);
  } catch (err) {
    console.error('FINANCE PROJECTS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, code, financeSiteId, quotationId, status } = req.body;
    const project = await prisma.financeProject.create({
      data: {
        name,
        code: code || null,
        financeSiteId: financeSiteId || null,
        quotationId: quotationId || null,
        status: status || 'ACTIVE',
      },
    });
    res.status(201).json(project);
  } catch (err) {
    console.error('FINANCE PROJECT CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/projects-summary', async (req: Request, res: Response) => {
  try {
    const summaries = await getProjectsSummary();
    res.json(summaries);
  } catch (err) {
    console.error('FINANCE PROJECTS SUMMARY ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch projects summary' });
  }
});

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await prisma.financeProject.findUnique({
      where: { id: req.params.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    console.error('FINANCE PROJECT GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.get('/projects/:id/costing', async (req: Request, res: Response) => {
  try {
    const summary = await getProjectCostingSummary(req.params.id);
    if (!summary) return res.status(404).json({ error: 'Project not found' });
    res.json(summary);
  } catch (err) {
    console.error('FINANCE PROJECT COSTING ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch project costing' });
  }
});

router.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { name, code, financeSiteId, quotationId, status } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code || null;
    if (financeSiteId !== undefined) data.financeSiteId = financeSiteId || null;
    if (quotationId !== undefined) data.quotationId = quotationId || null;
    if (status !== undefined) data.status = status;

    const project = await prisma.financeProject.update({
      where: { id: req.params.id },
      data,
    });
    res.json(project);
  } catch (err) {
    console.error('FINANCE PROJECT UPDATE ERROR:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    await prisma.financeProject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE PROJECT DELETE ERROR:', err);
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    if (code === 'P2003') {
      return res.status(400).json({ error: 'Cannot delete: project has linked expenses, incomes, or bills.' });
    }
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ─── Purchase Bills ─────────────────────────────────────────────────────────
router.get('/purchase-bills', async (req: Request, res: Response) => {
  try {
    const vendorId = req.query.vendorId as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const where: Record<string, unknown> = {};
    if (vendorId) where.vendorId = vendorId;
    if (projectId) where.projectId = projectId;
    const bills = await prisma.purchaseBill.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error('FINANCE PURCHASE BILLS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch purchase bills' });
  }
});

router.post('/purchase-bills', async (req: Request, res: Response) => {
  try {
    const { vendorId, projectId, gstNumber, invoiceNo, baseAmount, gstAmount, totalAmount, fileUrl } = req.body;
    const bill = await prisma.purchaseBill.create({
      data: {
        vendorId,
        projectId: projectId || null,
        gstNumber: gstNumber || null,
        invoiceNo,
        baseAmount: Number(baseAmount),
        gstAmount: Number(gstAmount),
        totalAmount: Number(totalAmount),
        fileUrl: fileUrl || null,
      },
      include: { vendor: true },
    });
    res.status(201).json(bill);
  } catch (err) {
    console.error('FINANCE PURCHASE BILL CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create purchase bill' });
  }
});

// ─── Sales Bills ────────────────────────────────────────────────────────────
router.get('/sales-bills', async (req: Request, res: Response) => {
  try {
    const clientId = req.query.clientId as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (projectId) where.projectId = projectId;
    const bills = await prisma.salesBill.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bills);
  } catch (err) {
    console.error('FINANCE SALES BILLS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch sales bills' });
  }
});

router.post('/sales-bills', async (req: Request, res: Response) => {
  try {
    const { clientId, projectId, gstNumber, invoiceNo, baseAmount, gstAmount, totalAmount, fileUrl } = req.body;
    const bill = await prisma.salesBill.create({
      data: {
        clientId,
        projectId: projectId || null,
        gstNumber: gstNumber || null,
        invoiceNo,
        baseAmount: Number(baseAmount),
        gstAmount: Number(gstAmount),
        totalAmount: Number(totalAmount),
        fileUrl: fileUrl || null,
      },
      include: { client: true },
    });
    res.status(201).json(bill);
  } catch (err) {
    console.error('FINANCE SALES BILL CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create sales bill' });
  }
});

// ─── Invoices ──────────────────────────────────────────────────────────────
router.get('/invoices/:id/pdf', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const items = (invoice.items as { name?: string; description?: string; hsn?: string; qty?: number; rate?: number; amount?: number }[]).map((i) => ({
      name: i.name ?? 'Item',
      description: i.description,
      hsn: i.hsn,
      qty: Number(i.qty) || 1,
      rate: Number(i.rate) || 0,
      amount: Number(i.amount) || Number(i.qty || 1) * (Number(i.rate) || 0),
    }));

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const gstRate = 18;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const cgst = Math.round(gstAmount / 2);
    const sgst = gstAmount - cgst;
    const totalAmount = invoice.totalAmount || subtotal + gstAmount;

    const { generateInvoicePdf } = await import('../services/invoice-pdf.service.js');
    const pdfData = {
      invoiceNo: `INV-${invoice.id.slice(-8).toUpperCase()}`,
      type: invoice.type,
      date: new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      client: {
        name: invoice.client.name,
        address: invoice.client.address ?? undefined,
        gstin: invoice.client.gstin ?? undefined,
      },
      items,
      subtotal,
      gstRate,
      cgst,
      sgst,
      gstAmount,
      totalAmount: invoice.totalAmount || totalAmount,
    };

    const pdfBytes = await generateInvoicePdf(pdfData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${pdfData.invoiceNo}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('FINANCE INVOICE PDF ERROR:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate PDF' });
  }
});

router.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    console.error('FINANCE INVOICE GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.get('/invoices', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const invoices = await prisma.invoice.findMany({
      where: type ? { type: type as 'SPGS' | 'PRODUCT' | 'SERVICE' | 'PROFORMA' } : undefined,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    console.error('FINANCE INVOICES ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const { type, clientId, quotationId, items, totalAmount, fileUrl } = req.body;
    const invoice = await prisma.invoice.create({
      data: {
        type,
        clientId,
        quotationId: quotationId || null,
        items: items ?? [],
        totalAmount: Number(totalAmount),
        fileUrl: fileUrl || null,
      },
      include: { client: true },
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('FINANCE INVOICE CREATE ERROR:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

export default router;
