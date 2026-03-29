import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Prisma, PrismaClient, type InvoiceMainKind, type InvoiceSubtype } from '@prisma/client';
import multer from 'multer';
import { join, resolve } from 'path';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { authenticate } from '../middleware/auth.js';
import { requireFinanceAccess } from '../middleware/finance-access.js';
import { bankStatementService } from '../services/bank-statement.service.js';
import { getProjectCostingSummary, getProjectsSummary } from '../services/project-costing.service.js';
import * as financeAuthService from '../services/finance-auth.service.js';
import { computeSpgsTotals, type SpgsInput } from '../services/invoice-spgs.service.js';
import { generateSpgsTurnkeyPdf } from '../services/invoice-pdf-spgs.js';
import { placeOfSupplyFromGstin } from '../services/spgs-invoice-pdf/placeOfSupply.js';
import { createDefaultInvoiceTemplateConfig, mergeInvoiceTemplateConfig } from '../services/invoice-template-config.js';
import {
  canConvertInvoice,
  documentTitleForMainKind,
  mergeTemplateConfigWithMainKind,
} from '../services/invoice-document-kind.js';
import {
  allocateNextInvoiceNumber,
  ensureFinanceInvoiceSequences,
  peekNextInvoiceNumber,
} from '../services/invoice-sequence.service.js';
import { buildSampleSpgsPdfInputForPreview } from '../services/invoice-template-preview.js';
import { buildSpgsInvoiceHtmlDocument } from '../services/spgs-invoice-html/spgsInvoiceHtmlDocument.js';
import { resolveInvoiceLogoDataUrl } from '../services/spgs-invoice-html/renderSpgsPdfFromHtml.js';
import { getInvoiceBranding } from '../services/invoice-branding.js';
import {
  uploadBankTransactionBill,
  deleteBankTransactionBill,
  contentTypeForBankBillFile,
  BANK_BILL_DIR,
} from '../services/bank-transaction-bill.service.js';

async function deleteBankBillsBeforeSplitRewrite(transactionId: string): Promise<void> {
  try {
    await deleteBankTransactionBill(transactionId, undefined);
    const oldSplits = await prisma.transactionSplit.findMany({
      where: { transactionId },
      select: { id: true },
    });
    for (const s of oldSplits) {
      await deleteBankTransactionBill(transactionId, s.id);
    }
  } catch (e) {
    // DB may not have bill-link columns yet, or cleanup is optional — do not block split create/clear.
    console.warn('FINANCE: deleteBankBillsBeforeSplitRewrite skipped:', e);
  }
}

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

const INVOICE_ANNEXURE_DIR = join(process.cwd(), 'uploads', 'invoice-annexures');

/** YYYY-MM-DD from client → UTC calendar date for storage */
function parseInvoiceDateBody(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d));
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function formatInvoicePdfDate(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type InvoiceDocumentMeta = { invoiceNumber?: string; invoiceDate?: string };

function getDocumentMetaFromItems(items: unknown): InvoiceDocumentMeta {
  if (!items || typeof items !== 'object' || Array.isArray(items)) return {};
  const o = items as { version?: number; documentMeta?: InvoiceDocumentMeta };
  if (o.version !== 2 || !o.documentMeta || typeof o.documentMeta !== 'object') return {};
  const m = o.documentMeta;
  return {
    invoiceNumber: typeof m.invoiceNumber === 'string' ? m.invoiceNumber.trim() : undefined,
    invoiceDate: typeof m.invoiceDate === 'string' ? m.invoiceDate.trim() : undefined,
  };
}

/** Display number on PDF: simple "1", "2", … or legacy INV-… */
function invoiceDocNo(invoice: { id: string; items: unknown; invoiceNumber?: string | null }): string {
  const col = invoice.invoiceNumber?.trim();
  if (col) return col;
  const n = getDocumentMetaFromItems(invoice.items).invoiceNumber;
  if (n) return n;
  return `INV-${invoice.id.slice(-8).toUpperCase()}`;
}

function invoicePdfDateDisplay(invoice: {
  createdAt: Date;
  items: unknown;
  invoiceDate?: Date | null;
}): string {
  if (invoice.invoiceDate) {
    return formatInvoicePdfDate(new Date(invoice.invoiceDate));
  }
  const raw = getDocumentMetaFromItems(invoice.items).invoiceDate;
  if (raw) {
    const parsed = parseInvoiceDateBody(raw);
    if (parsed) return formatInvoicePdfDate(parsed);
  }
  return new Date(invoice.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeInvoiceNumber(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return null;
  return s;
}

/** DB missing `finance_invoices.deleted_at` (soft-delete migration not applied). */
function isMissingInvoiceDeletedAtColumn(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; meta?: { column?: unknown }; message?: string };
  const m = e.message ?? '';
  if (/deleted_at/i.test(m) && (/does not exist/i.test(m) || /Unknown column/i.test(m))) return true;
  if (e.code === 'P2022') {
    const col = e.meta?.column;
    if (typeof col === 'string' && col.includes('deleted_at')) return true;
    return /deleted_at/i.test(m);
  }
  return false;
}

const SUBTYPE_ORDER: InvoiceSubtype[] = ['SPGS', 'SERVICE', 'PRODUCT'];

const SYSTEM_INVOICE_TEMPLATE_SLUGS: Record<InvoiceSubtype, string> = {
  SPGS: 'system-spgs',
  SERVICE: 'system-service',
  PRODUCT: 'system-product',
};

const SYSTEM_INVOICE_TEMPLATE_NAMES: Record<InvoiceSubtype, string> = {
  SPGS: 'SPGS (layout)',
  SERVICE: 'Service (layout)',
  PRODUCT: 'Product (layout)',
};

async function ensureDefaultInvoiceTemplates(): Promise<void> {
  const def = createDefaultInvoiceTemplateConfig();
  const json = def as unknown as Prisma.InputJsonValue;
  for (const t of SUBTYPE_ORDER) {
    const slug = SYSTEM_INVOICE_TEMPLATE_SLUGS[t];
    const name = SYSTEM_INVOICE_TEMPLATE_NAMES[t];
    const bySubtype = await prisma.invoiceTemplate.findUnique({ where: { subtype: t } });
    const bySlug = await prisma.invoiceTemplate.findUnique({ where: { slug } });
    // Legacy/migrated DBs may have the canonical slug on a row with the wrong subtype.
    // Upsert-by-subtype alone would try to CREATE and hit unique `slug`.
    if (bySubtype && bySlug && bySubtype.id !== bySlug.id) {
      await prisma.invoiceTemplate.update({
        where: { id: bySlug.id },
        data: { slug: `${slug}-superseded-${bySlug.id.slice(-6)}` },
      });
    }
    const target = bySubtype ?? bySlug;
    if (target) {
      // Do not overwrite config — user edits live in DB; resetting here wiped layout on every GET /invoice-templates.
      await prisma.invoiceTemplate.update({
        where: { id: target.id },
        data: { name, slug, subtype: t },
      });
    } else {
      await prisma.invoiceTemplate.create({
        data: { name, slug, subtype: t, config: json },
      });
    }
  }
}

async function resolveTemplateIdForSubtype(subtype: InvoiceSubtype): Promise<string | null> {
  await ensureDefaultInvoiceTemplates();
  const row = await prisma.invoiceTemplate.findUnique({ where: { subtype } });
  return row?.id ?? null;
}

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

function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

router.post('/clients', async (req: Request, res: Response) => {
  try {
    const { name, companyName, gstin, contact, address, customerId } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const cid = typeof customerId === 'string' ? customerId.trim() : '';
    if (cid) {
      const salesCustomer = await prisma.customer.findUnique({
        where: { id: cid },
        select: { id: true },
      });
      if (!salesCustomer) {
        return res.status(400).json({
          error:
            'Linked sales customer no longer exists. Create the client without linking, or pick import again.',
        });
      }
    }

    const client = await prisma.financeClient.create({
      data: {
        name: trimmedName,
        companyName: emptyToNull(companyName),
        gstin: emptyToNull(gstin),
        contact: emptyToNull(contact),
        address: emptyToNull(address),
        customerId: cid || null,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    console.error('FINANCE CLIENT CREATE ERROR:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    let error = 'Failed to create client';
    let details: string | undefined;
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      details = err.message;
      if (err.code === 'P2022') {
        error =
          'Database is missing a column (often companyName). From apps/backend run: npm run db:fix-company-column — or: npx prisma db push — If migrations are blocked, fix the failed migration then: npx prisma migrate deploy';
      }
    } else if (err instanceof Error) {
      details = err.message;
    }
    res.status(500).json({
      error,
      ...(details && (isDev || error.includes('migrate')) ? { details } : {}),
    });
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
    const { name, companyName, gstin, contact, address, customerId } = req.body;
    const client = await prisma.financeClient.update({
      where: { id: req.params.id },
      data: { name, companyName, gstin, contact, address, customerId },
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
    const trash = req.query.trash === 'true';
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
      trash,
    });

    res.json({ transactions, total });
  } catch (err) {
    console.error('FINANCE BANK TRANSACTIONS LIST ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.post('/bank-transactions', async (req: Request, res: Response) => {
  try {
    const {
      uploadId,
      transactionDate,
      partyName,
      description,
      amount,
      type,
      categoryId,
      siteId,
      listSortDate,
      splits,
    } = req.body as {
      uploadId?: string;
      transactionDate?: string;
      partyName?: string | null;
      description?: string | null;
      amount?: number;
      type?: 'INCOME' | 'EXPENSE';
      categoryId?: string | null;
      siteId?: string | null;
      listSortDate?: 'asc' | 'desc';
      splits?: { categoryId: string; siteId?: string | null; amount: number; description?: string | null }[];
    };
    if (!uploadId || !transactionDate || !type) {
      return res.status(400).json({ error: 'uploadId, transactionDate, and type are required' });
    }
    if (type !== 'INCOME' && type !== 'EXPENSE') {
      return res.status(400).json({ error: 'type must be INCOME or EXPENSE' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    const d = new Date(transactionDate);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: 'Invalid transactionDate' });
    }
    const txn = await bankStatementService.createManualTransaction({
      uploadId,
      transactionDate: d,
      partyName: partyName ?? null,
      description: description ?? null,
      amount: amt,
      type,
      categoryId: categoryId ?? null,
      siteId: siteId ?? null,
      listSortDate: listSortDate === 'asc' ? 'asc' : 'desc',
      splits: Array.isArray(splits) && splits.length >= 2 ? splits : undefined,
    });
    res.status(201).json(txn);
  } catch (err) {
    console.error('FINANCE BANK TRANSACTION CREATE ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create transaction';
    if (msg.includes('not found')) return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

router.post('/bank-transactions/reorder', async (req: Request, res: Response) => {
  try {
    const { uploadId, orderedIds } = req.body as { uploadId?: string; orderedIds?: string[] };
    if (!uploadId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: 'uploadId and orderedIds required' });
    }
    await bankStatementService.reorderTransactions(uploadId, orderedIds);
    res.json({ ok: true });
  } catch (err) {
    console.error('FINANCE BANK TRANSACTIONS REORDER ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to reorder';
    res.status(400).json({ error: msg });
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

router.post('/bank-transactions/bulk-soft-delete', async (req: Request, res: Response) => {
  try {
    const { ids, uploadId } = req.body as { ids?: string[]; uploadId?: string };
    if (!uploadId || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'uploadId and ids required' });
    }
    const result = await bankStatementService.bulkSoftDelete(uploadId, ids);
    res.json(result);
  } catch (err) {
    console.error('FINANCE BULK SOFT DELETE ERROR:', err);
    res.status(500).json({ error: 'Failed to move to recycle bin' });
  }
});

router.post('/bank-transactions/bulk-restore', async (req: Request, res: Response) => {
  try {
    const { ids, uploadId } = req.body as { ids?: string[]; uploadId?: string };
    if (!uploadId || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'uploadId and ids required' });
    }
    const result = await bankStatementService.bulkRestore(uploadId, ids);
    res.json(result);
  } catch (err) {
    console.error('FINANCE BULK RESTORE ERROR:', err);
    res.status(500).json({ error: 'Failed to restore transactions' });
  }
});

router.post('/bank-transactions/bulk-permanent-delete', async (req: Request, res: Response) => {
  try {
    const { ids, uploadId } = req.body as { ids?: string[]; uploadId?: string };
    if (!uploadId || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'uploadId and ids required' });
    }
    const result = await bankStatementService.bulkHardDelete(uploadId, ids);
    res.json(result);
  } catch (err) {
    console.error('FINANCE BULK PERMANENT DELETE ERROR:', err);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

router.get('/bank-transactions/summary', async (req: Request, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string | undefined;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;

    const where: Parameters<typeof prisma.bankTransaction.aggregate>[0]['where'] = {
      duplicateOfId: null,
      deletedAt: null,
    };
    if (uploadId) where.uploadId = uploadId;
    if (fromStr || toStr) {
      where.transactionDate = {};
      if (fromStr) (where.transactionDate as { gte?: Date }).gte = new Date(fromStr);
      if (toStr) (where.transactionDate as { lte?: Date }).lte = new Date(toStr);
    }

    const [expenseRows, uncategorizedCount, totalIncome, totalExpense] = await Promise.all([
      prisma.bankTransaction.findMany({
        where: { ...where, type: 'EXPENSE' },
        select: {
          amount: true,
          isSplit: true,
          categoryId: true,
          splits: { select: { amount: true, categoryId: true } },
        },
      }),
      prisma.bankTransaction.count({ where: { ...where, isSplit: false, categoryId: null } }),
      prisma.bankTransaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.bankTransaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);

    const catIds = [
      ...new Set(
        expenseRows.flatMap((e) =>
          e.isSplit ? e.splits.map((s) => s.categoryId) : e.categoryId ? [e.categoryId] : []
        )
      ),
    ].filter(Boolean) as string[];
    const cats = catIds.length ? await prisma.transactionCategory.findMany({ where: { id: { in: catIds } } }) : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
    const byCategoryMap: Record<string, number> = {};
    for (const t of expenseRows) {
      if (t.isSplit && t.splits.length > 0) {
        for (const s of t.splits) {
          const key = catMap[s.categoryId] ?? s.categoryId;
          byCategoryMap[key] = (byCategoryMap[key] ?? 0) + s.amount;
        }
      } else if (!t.isSplit) {
        const key = t.categoryId ? (catMap[t.categoryId] ?? t.categoryId) : 'UNCATEGORIZED';
        byCategoryMap[key] = (byCategoryMap[key] ?? 0) + t.amount;
      } else if (t.isSplit && t.splits.length === 0) {
        byCategoryMap['UNCATEGORIZED'] = (byCategoryMap['UNCATEGORIZED'] ?? 0) + t.amount;
      }
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
    });
    const uploadsWithCount = await Promise.all(
      uploads.map(async (u) => ({
        ...u,
        _count: {
          transactions: await prisma.bankTransaction.count({
            where: { uploadId: u.id, deletedAt: null },
          }),
        },
      }))
    );
    res.json(uploadsWithCount);
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
    const txn = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { amount: true, id: true },
    });
    if (!txn) return res.status(404).json({ error: 'Transaction not found or is in the recycle bin' });

    const totalSplit = splits.reduce((s, sp) => s + sp.amount, 0);
    if (Math.abs(totalSplit - txn.amount) > 0.01) {
      return res.status(400).json({ error: 'Split amounts must sum to transaction amount' });
    }

    await deleteBankBillsBeforeSplitRewrite(req.params.id);
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
      data: { isSplit: true, categoryId: null, siteId: null },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLIT CREATE ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to create splits';
    res.status(500).json({ error: msg });
  }
});

router.delete('/bank-transactions/:id/splits', async (req: Request, res: Response) => {
  try {
    const active = await prisma.bankTransaction.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: { id: true },
    });
    if (!active) return res.status(404).json({ error: 'Transaction not found or is in the recycle bin' });
    await deleteBankBillsBeforeSplitRewrite(req.params.id);
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

router.patch('/bank-transactions/:id/splits/:splitId', async (req: Request, res: Response) => {
  try {
    const { amount, description, categoryId, siteId } = req.body as {
      amount?: number;
      description?: string | null;
      categoryId?: string;
      siteId?: string | null;
    };
    const updated = await bankStatementService.updateTransactionSplit(req.params.id, req.params.splitId, {
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(siteId !== undefined ? { siteId } : {}),
    });
    res.json(updated);
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLIT PATCH ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to update split';
    res.status(400).json({ error: msg });
  }
});

router.delete('/bank-transactions/:id/splits/:splitId', async (req: Request, res: Response) => {
  try {
    await bankStatementService.deleteTransactionSplit(req.params.id, req.params.splitId);
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE TRANSACTION SPLIT DELETE ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to delete split';
    res.status(400).json({ error: msg });
  }
});

router.post('/bank-transactions/:transactionId/bill', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ error: 'No file uploaded' });
    const splitId =
      typeof req.body.splitId === 'string' && req.body.splitId.trim() ? req.body.splitId.trim() : undefined;
    const result = await uploadBankTransactionBill({
      transactionId: req.params.transactionId,
      splitId,
      buffer: file.buffer,
      originalName: file.originalname || 'file',
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('FINANCE BANK TX BILL UPLOAD ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: msg });
  }
});

router.delete('/bank-transactions/:transactionId/bill', async (req: Request, res: Response) => {
  try {
    const splitId =
      typeof req.query.splitId === 'string' && req.query.splitId.trim() ? req.query.splitId.trim() : undefined;
    await deleteBankTransactionBill(req.params.transactionId, splitId);
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE BANK TX BILL DELETE ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Delete failed';
    res.status(400).json({ error: msg });
  }
});

router.get('/bank-transaction-bills/:name', async (req: Request, res: Response) => {
  try {
    const raw = req.params.name.replace(/[^a-f0-9._-]/gi, '');
    const base = resolve(BANK_BILL_DIR);
    const full = resolve(base, raw);
    if (!full.startsWith(base) || !existsSync(full)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const buf = readFileSync(full);
    res.setHeader('Content-Type', contentTypeForBankBillFile(raw));
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('FINANCE BANK TX BILL FILE ERROR:', err);
    res.status(500).json({ error: 'Failed to read file' });
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

// ─── Sales customers (read-only for linking / prefilling finance clients) ─
router.get('/sales-customers', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        gstin: true,
      },
    });
    res.json(customers);
  } catch (err) {
    console.error('FINANCE SALES CUSTOMERS ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch sales customers' });
  }
});

router.post('/invoices/annexure-upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file?.buffer) return res.status(400).json({ error: 'No file uploaded' });
    if (!existsSync(INVOICE_ANNEXURE_DIR)) mkdirSync(INVOICE_ANNEXURE_DIR, { recursive: true });
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const name = `${randomBytes(16).toString('hex')}-${safe}`;
    writeFileSync(join(INVOICE_ANNEXURE_DIR, name), file.buffer);
    res.json({
      fileUrl: `/api/finance/invoices/annexure-file/${name}`,
      fileName: file.originalname || safe,
    });
  } catch (err) {
    console.error('FINANCE INVOICE ANNEXURE UPLOAD ERROR:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.get('/invoices/annexure-file/:name', async (req: Request, res: Response) => {
  try {
    const raw = req.params.name.replace(/[^a-f0-9._-]/gi, '');
    const base = resolve(INVOICE_ANNEXURE_DIR);
    const full = resolve(base, raw);
    if (!full.startsWith(base) || !existsSync(full)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const buf = readFileSync(full);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('FINANCE INVOICE ANNEXURE GET ERROR:', err);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// ─── Invoice templates (no-code SPGS layout) ───────────────────────────────
router.get('/invoice-templates', async (_req: Request, res: Response) => {
  try {
    await ensureDefaultInvoiceTemplates();
    const list = await prisma.invoiceTemplate.findMany();
    const order = new Map(SUBTYPE_ORDER.map((t, i) => [t, i]));
    list.sort((a, b) => (order.get(a.subtype) ?? 99) - (order.get(b.subtype) ?? 99));
    res.json(list);
  } catch (err) {
    console.error('FINANCE INVOICE TEMPLATES LIST ERROR:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to list invoice templates',
      ...(isDev && msg ? { details: msg } : {}),
    });
  }
});

router.post('/invoice-templates/preview-html', async (req: Request, res: Response) => {
  try {
    const raw = req.body as { config?: unknown };
    const cfg = mergeInvoiceTemplateConfig(raw?.config);
    const html = buildSpgsInvoiceHtmlDocument({
      data: buildSampleSpgsPdfInputForPreview(cfg),
      branding: getInvoiceBranding(),
      logoDataUrl: resolveInvoiceLogoDataUrl(),
      templateConfig: cfg,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('FINANCE INVOICE TEMPLATE PREVIEW POST ERROR:', err);
    res.status(500).json({ error: 'Failed to render preview' });
  }
});

router.get('/invoice-templates/:id/preview-html', async (req: Request, res: Response) => {
  try {
    const t = await prisma.invoiceTemplate.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const cfg = mergeInvoiceTemplateConfig(t.config);
    const html = buildSpgsInvoiceHtmlDocument({
      data: buildSampleSpgsPdfInputForPreview(cfg),
      branding: getInvoiceBranding(),
      logoDataUrl: resolveInvoiceLogoDataUrl(),
      templateConfig: cfg,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('FINANCE INVOICE TEMPLATE PREVIEW ERROR:', err);
    res.status(500).json({ error: 'Failed to render preview' });
  }
});

router.get('/invoice-templates/:id', async (req: Request, res: Response) => {
  try {
    const t = await prisma.invoiceTemplate.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json(t);
  } catch (err) {
    console.error('FINANCE INVOICE TEMPLATE GET ERROR:', err);
    res.status(500).json({ error: 'Failed to fetch invoice template' });
  }
});

router.post('/invoice-templates', async (_req: Request, res: Response) => {
  res.status(400).json({
    error: 'Invoice layouts are fixed per invoice type (SPGS, Product, Service, Proforma). Edit them in this list.',
  });
});

router.patch('/invoice-templates/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body as { name?: string; config?: unknown };
    const cur = await prisma.invoiceTemplate.findUnique({ where: { id: req.params.id } });
    if (!cur) return res.status(404).json({ error: 'Template not found' });
    const mergedConfig =
      body.config !== undefined
        ? mergeInvoiceTemplateConfig(body.config)
        : mergeInvoiceTemplateConfig(cur.config);
    const row = await prisma.invoiceTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        config: mergedConfig as unknown as Prisma.InputJsonValue,
      },
    });
    res.json(row);
  } catch (err) {
    console.error('FINANCE INVOICE TEMPLATE PATCH ERROR:', err);
    res.status(500).json({ error: 'Failed to update invoice template' });
  }
});

router.delete('/invoice-templates/:id', async (_req: Request, res: Response) => {
  res.status(400).json({
    error: 'Invoice layouts cannot be deleted. Each invoice type has one layout; clear its fields in the editor if needed.',
  });
});

// ─── Invoices ──────────────────────────────────────────────────────────────
router.get('/invoices/next-number', async (req: Request, res: Response) => {
  try {
    const raw = req.query.mainKind as string | undefined;
    const validMain: InvoiceMainKind[] = ['TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL'];
    if (!raw || !validMain.includes(raw as InvoiceMainKind)) {
      return res.status(400).json({ error: 'Query mainKind is required (TAX_INVOICE, PROFORMA_INVOICE, QUOTATION, EWAY_BILL)' });
    }
    const next = await peekNextInvoiceNumber(prisma, raw as InvoiceMainKind);
    res.json(next);
  } catch (err) {
    console.error('FINANCE INVOICE NEXT NUMBER ERROR:', err);
    res.status(500).json({ error: 'Failed to read next number' });
  }
});

router.get('/invoices/:id/pdf', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true, template: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const raw = invoice.items as unknown;
    const isV2 =
      raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      (raw as { version?: number }).version === 2;

    if (isV2 && (raw as { billingMode?: string }).billingMode === 'SPGS') {
      const payload = raw as {
        spgs?: {
          systemSizeKw: number;
          panelWattage: number;
          panelSerials: string[];
          inverterSerials?: string[];
          panelMake?: string;
          inverterMake?: string;
          siteName?: string;
          siteAddress?: string;
          gstMode: 'blended' | 'split' | 'epc';
          computed: import('../services/invoice-spgs.service.js').SpgsComputed;
          annexures?: { label: string; fileName?: string }[];
        };
      };
      const sp = payload.spgs;
      if (!sp?.computed) return res.status(500).json({ error: 'Invalid SPGS invoice payload' });

      const invDate = invoicePdfDateDisplay(invoice);
      const baseConfig =
        invoice.template?.config ??
        (await prisma.invoiceTemplate.findUnique({ where: { subtype: invoice.subtype } }))?.config ??
        {};
      const templateConfig = mergeTemplateConfigWithMainKind(baseConfig, invoice.mainKind);
      const pdfBytes = await generateSpgsTurnkeyPdf(
        {
          invoiceNo: invoiceDocNo(invoice),
          date: invDate,
          dueDate: invDate,
          clientName: invoice.client.name,
          companyName: (invoice.client as { companyName?: string | null }).companyName ?? undefined,
          address: invoice.client.address ?? undefined,
          gstin: invoice.client.gstin ?? undefined,
          contact: invoice.client.contact ?? undefined,
          placeOfSupply: placeOfSupplyFromGstin(invoice.client.gstin),
          transport: 'Hand Delivery',
          siteName: sp.siteName,
          siteAddress: sp.siteAddress,
          systemSizeKw: sp.systemSizeKw,
          panelWattage: sp.panelWattage,
          panelSerials: Array.isArray(sp.panelSerials) ? sp.panelSerials : [],
          inverterSerials: Array.isArray(sp.inverterSerials) ? sp.inverterSerials : undefined,
          panelMake: typeof sp.panelMake === 'string' && sp.panelMake.trim() ? sp.panelMake.trim() : undefined,
          inverterMake: typeof sp.inverterMake === 'string' && sp.inverterMake.trim() ? sp.inverterMake.trim() : undefined,
          computed: sp.computed,
          gstMode: sp.gstMode,
          annexures: sp.annexures ?? [],
        },
        { templateConfig }
      );
      res.setHeader('Content-Type', 'application/pdf');
      const safeName = invoiceDocNo(invoice).replace(/[^\w.-]+/g, '_');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${safeName}.pdf"`);
      res.send(Buffer.from(pdfBytes));
      return;
    }

    let items: { name: string; description?: string; hsn?: string; qty: number; rate: number; amount: number }[];
    /** Set for v2 NON_SPGS: sum of per-line GST (PDF uses aggregate line, not flat 18%). */
    let gstFromLineSum: number | undefined;
    if (isV2 && (raw as { billingMode?: string }).billingMode === 'NON_SPGS') {
      const ns = (raw as { nonSpgs?: { items?: unknown[] } }).nonSpgs;
      const arr = Array.isArray(ns?.items) ? ns!.items! : [];
      gstFromLineSum = arr.reduce((s: number, i: unknown) => {
        const row = i as Record<string, unknown>;
        return s + (Number(row.gstAmount) || 0);
      }, 0);
      items = arr.map((i: unknown) => {
        const row = i as Record<string, unknown>;
        return {
        name: String(row.name ?? 'Item'),
        description: row.description ? String(row.description) : undefined,
        hsn: row.hsn ? String(row.hsn) : undefined,
        qty: Number(row.qty) || 1,
        rate: Number(row.rate) || 0,
        amount: Number(row.amount) || 0,
      };
      });
    } else if (Array.isArray(raw)) {
      items = (raw as { name?: string; description?: string; hsn?: string; qty?: number; rate?: number; amount?: number }[]).map((i) => ({
        name: i.name ?? 'Item',
        description: i.description,
        hsn: i.hsn,
        qty: Number(i.qty) || 1,
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || Number(i.qty || 1) * (Number(i.rate) || 0),
      }));
    } else {
      return res.status(500).json({ error: 'Unsupported invoice items format' });
    }

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const gstRate = 18;
    const gstAggregateOnly = gstFromLineSum !== undefined;
    const gstAmount =
      gstFromLineSum !== undefined ? gstFromLineSum : Math.round((subtotal * gstRate) / 100);
    const cgst = Math.round(gstAmount / 2);
    const sgst = gstAmount - cgst;
    const totalAmount = invoice.totalAmount || subtotal + gstAmount;

    const { generateInvoicePdf } = await import('../services/invoice-pdf.service.js');
    const docDateStr = invoicePdfDateDisplay(invoice);
    const pdfData = {
      invoiceNo: invoiceDocNo(invoice),
      type: `${invoice.mainKind} · ${invoice.subtype}`,
      documentTitle: documentTitleForMainKind(invoice.mainKind),
      date: docDateStr,
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
      gstAggregateOnly,
    };

    const pdfBytes = await generateInvoicePdf(pdfData);
    res.setHeader('Content-Type', 'application/pdf');
    const safeName = String(pdfData.invoiceNo).replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${safeName}.pdf"`);
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
    const mainKind = req.query.mainKind as string | undefined;
    const subtype = req.query.subtype as string | undefined;
    const trashed = req.query.trashed === '1' || req.query.trashed === 'true';
    const filterWhere: Prisma.InvoiceWhereInput = {
      ...(mainKind ? { mainKind: mainKind as InvoiceMainKind } : {}),
      ...(subtype ? { subtype: subtype as InvoiceSubtype } : {}),
    };
    try {
      const invoices = await prisma.invoice.findMany({
        where: {
          ...filterWhere,
          ...(trashed ? { deletedAt: { not: null } } : { deletedAt: null }),
        },
        include: { client: true },
        orderBy: trashed ? { deletedAt: 'desc' } : { createdAt: 'desc' },
      });
      return res.json(invoices);
    } catch (inner) {
      if (isMissingInvoiceDeletedAtColumn(inner)) {
        if (trashed) return res.json([]);
        const invoices = await prisma.invoice.findMany({
          where: filterWhere,
          include: { client: true },
          orderBy: { createdAt: 'desc' },
        });
        return res.json(invoices);
      }
      throw inner;
    }
  } catch (err) {
    console.error('FINANCE INVOICES ERROR:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Failed to fetch invoices',
      ...(isDev && msg ? { details: msg } : {}),
    });
  }
});

router.post('/invoices', async (req: Request, res: Response) => {
  try {
    const {
      mainKind: rawMainKind,
      subtype: rawSubtype,
      clientId,
      quotationId,
      items,
      totalAmount,
      fileUrl,
      spgsPayload,
      lineItems,
      invoiceNumber: rawInvoiceNumber,
      invoiceDate: rawInvoiceDate,
    } = req.body;

    const validMain: InvoiceMainKind[] = ['TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL'];
    const validSub: InvoiceSubtype[] = ['SPGS', 'SERVICE', 'PRODUCT'];
    if (!rawMainKind || !validMain.includes(rawMainKind as InvoiceMainKind)) {
      return res.status(400).json({ error: 'Valid mainKind is required (TAX_INVOICE, PROFORMA_INVOICE, QUOTATION, EWAY_BILL)' });
    }
    if (!rawSubtype || !validSub.includes(rawSubtype as InvoiceSubtype)) {
      return res.status(400).json({ error: 'Valid subtype is required (SPGS, SERVICE, PRODUCT)' });
    }
    const mainKind = rawMainKind as InvoiceMainKind;
    const subtype = rawSubtype as InvoiceSubtype;

    if (subtype === 'SPGS' && (!spgsPayload || typeof spgsPayload !== 'object')) {
      return res.status(400).json({ error: 'spgsPayload is required for SPGS subtype' });
    }
    if ((subtype === 'PRODUCT' || subtype === 'SERVICE') && (!Array.isArray(lineItems) || lineItems.length === 0)) {
      return res.status(400).json({ error: 'lineItems are required for Product/Service subtype' });
    }

    let invoiceNumber = normalizeInvoiceNumber(rawInvoiceNumber);
    if (rawInvoiceNumber !== undefined && rawInvoiceNumber !== null && String(rawInvoiceNumber).trim() !== '' && invoiceNumber === null) {
      return res.status(400).json({ error: 'Invoice number must be digits only (e.g. 1, 2, 3)' });
    }
    await ensureFinanceInvoiceSequences(prisma);
    if (invoiceNumber === null) {
      invoiceNumber = await allocateNextInvoiceNumber(prisma, mainKind);
    }

    const invoiceDateStr =
      typeof rawInvoiceDate === 'string' && rawInvoiceDate.trim() ? rawInvoiceDate.trim() : undefined;
    const invoiceDateParsed = invoiceDateStr ? parseInvoiceDateBody(invoiceDateStr) : undefined;
    const documentMeta: InvoiceDocumentMeta = {
      ...(invoiceNumber ? { invoiceNumber } : {}),
      ...(invoiceDateStr ? { invoiceDate: invoiceDateStr } : {}),
    };

    let itemsJson: unknown = items ?? [];
    let total = Number(totalAmount) || 0;

    if (subtype === 'SPGS' && spgsPayload && typeof spgsPayload === 'object') {
      const p = spgsPayload as SpgsInput;
      const computed = computeSpgsTotals(p);
      itemsJson = {
        version: 2,
        documentMeta,
        billingMode: 'SPGS',
        spgs: {
          ...p,
          annexures: Array.isArray((spgsPayload as { annexures?: unknown }).annexures)
            ? (spgsPayload as { annexures: { label: string; fileName?: string; fileUrl?: string }[] }).annexures
            : [],
          computed,
        },
      };
      total = computed.totalInclGst;
    } else if ((subtype === 'PRODUCT' || subtype === 'SERVICE') && Array.isArray(lineItems)) {
      const sub = lineItems.reduce((s: number, row: { amount?: number }) => s + (Number(row.amount) || 0), 0);
      const gst = lineItems.reduce((s: number, row: { gstAmount?: number }) => s + (Number(row.gstAmount) || 0), 0);
      itemsJson = {
        version: 2,
        documentMeta,
        billingMode: 'NON_SPGS',
        nonSpgs: { items: lineItems },
      };
      total = Number(totalAmount) || sub + gst;
    } else if (Array.isArray(items)) {
      const sub = (items as { amount?: number }[]).reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const g = Math.round((sub * 18) / 100);
      total = Number(totalAmount) || sub + g;
    }

    const templateId = await resolveTemplateIdForSubtype(subtype);

    const invoice = await prisma.invoice.create({
      data: {
        mainKind,
        subtype,
        clientId,
        quotationId: quotationId || null,
        items: itemsJson as object,
        totalAmount: total,
        fileUrl: fileUrl || null,
        invoiceNumber,
        invoiceDate: invoiceDateParsed ?? null,
        templateId: templateId ?? undefined,
      },
      include: { client: true },
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error('FINANCE INVOICE CREATE ERROR:', err);
    const message = err instanceof Error ? err.message : 'Failed to create invoice';
    res.status(500).json({ error: 'Failed to create invoice', details: message });
  }
});

router.post('/invoices/:id/convert', async (req: Request, res: Response) => {
  try {
    const { targetMainKind: rawTarget } = req.body as { targetMainKind?: string };
    const validMain: InvoiceMainKind[] = ['TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL'];
    if (!rawTarget || !validMain.includes(rawTarget as InvoiceMainKind)) {
      return res.status(400).json({ error: 'targetMainKind is required' });
    }
    const targetMainKind = rawTarget as InvoiceMainKind;
    const source = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Invoice not found' });
    if (source.deletedAt) return res.status(400).json({ error: 'Cannot convert a deleted invoice' });
    if (!canConvertInvoice(source.mainKind, targetMainKind)) {
      return res.status(400).json({ error: 'This conversion is not allowed' });
    }
    await ensureFinanceInvoiceSequences(prisma);
    const nextNo = await allocateNextInvoiceNumber(prisma, targetMainKind);
    const templateId = await resolveTemplateIdForSubtype(source.subtype);
    let nextItems: object = source.items as object;
    const rawItems = source.items as { documentMeta?: { invoiceNumber?: string; invoiceDate?: string } } | null;
    if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
      const dm = rawItems.documentMeta && typeof rawItems.documentMeta === 'object' ? rawItems.documentMeta : {};
      nextItems = {
        ...rawItems,
        documentMeta: { ...dm, invoiceNumber: nextNo },
      };
    }
    const created = await prisma.invoice.create({
      data: {
        mainKind: targetMainKind,
        subtype: source.subtype,
        clientId: source.clientId,
        quotationId: source.quotationId,
        items: nextItems,
        totalAmount: source.totalAmount,
        fileUrl: source.fileUrl,
        invoiceNumber: nextNo,
        invoiceDate: source.invoiceDate,
        templateId: templateId ?? undefined,
        convertedFromId: source.id,
      },
      include: { client: true },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('FINANCE INVOICE CONVERT ERROR:', err);
    res.status(500).json({ error: 'Failed to convert invoice' });
  }
});

router.delete('/invoices/:id/permanent', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.deletedAt) {
      return res.status(400).json({ error: 'Move to recycle bin before deleting permanently' });
    }
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE INVOICE PURGE ERROR:', err);
    res.status(500).json({ error: 'Failed to delete invoice permanently' });
  }
});

router.post('/invoices/:id/restore', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.deletedAt) {
      return res.status(400).json({ error: 'Invoice is not in recycle bin' });
    }
    const restored = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { deletedAt: null },
      include: { client: true },
    });
    res.json(restored);
  } catch (err) {
    console.error('FINANCE INVOICE RESTORE ERROR:', err);
    res.status(500).json({ error: 'Failed to restore invoice' });
  }
});

router.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.deletedAt) {
      return res.status(400).json({ error: 'Invoice is already in recycle bin' });
    }
    await prisma.invoice.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.status(204).send();
  } catch (err) {
    console.error('FINANCE INVOICE SOFT DELETE ERROR:', err);
    res.status(500).json({ error: 'Failed to move invoice to recycle bin' });
  }
});

export default router;
