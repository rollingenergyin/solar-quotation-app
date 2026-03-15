import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { Role } from '@prisma/client';
import { calculateQuotation } from '../services/quotation.service.js';
import { generateFilledPdf, calc30YrSavings, calcLoanEmi, type PdfValues } from '../services/pdf.service.js';
import { generateQuotationPdf, validatePdfToken } from '../services/pdf-generation.service.js';

const router = Router();
const prisma = new PrismaClient();

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads', 'quotations');

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

/** Generate QT-0001, QT-0002 style numbers for new quotations */
async function generateQTNumber(): Promise<string> {
  const result = await prisma.$queryRaw<{ nextValue: number }[]>`
    INSERT INTO quotation_sequence (id, "nextValue", "updatedAt")
    VALUES ('main', 1, NOW())
    ON CONFLICT (id) DO UPDATE SET "nextValue" = quotation_sequence."nextValue" + 1, "updatedAt" = NOW()
    RETURNING "nextValue"
  `;
  const next = result[0]?.nextValue ?? 1;
  return `QT-${String(next).padStart(4, '0')}`;
}

function generateQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SQ-${yy}${mm}-${rand}`;
}

/** List all saved quotations (for Saved Quotations page). Sales users see only their own. */
router.get('/saved', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const where: { result: { isNot: null }; createdById?: string } = { result: { isNot: null } };
    if (!isAdmin) {
      where.createdById = req.user!.userId;
    }

    const list = await prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        site: { select: { address: true, city: true } },
        createdBy: { select: { name: true, userId: true } },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const items = list.map((q) => {
      const br = (q.result as { breakdown?: { inputs?: { systemSizeKw?: number } } } | null)?.breakdown;
      const systemKw = br?.inputs?.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
      return {
        id: q.id,
        quoteNumber: q.quoteNumber,
        version: q.version,
        customerName: q.customer.name,
        systemSizeKw: systemKw,
        location: [q.site.address, q.site.city].filter(Boolean).join(', ') || '—',
        date: q.createdAt,
        type: q.quotationType,
        createdBy: q.createdBy.name,
        hasStoredPdf: !!q.generatedPdfPath,
      };
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** List all quotations (admin only) - with filters by salesperson and date */
router.get('/all', authenticate, requireRoles(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { createdBy, from, to } = req.query;
    const where: Record<string, unknown> = { result: { isNot: null } };
    if (typeof createdBy === 'string' && createdBy) {
      const u = await prisma.user.findFirst({ where: { userId: createdBy } });
      if (u) where.createdById = u.id;
    }
    if ((typeof from === 'string' && from) || (typeof to === 'string' && to)) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (typeof from === 'string' && from) dateFilter.gte = new Date(from);
      if (typeof to === 'string' && to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.createdAt = dateFilter;
    }

    const list = await prisma.quotation.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        site: { select: { address: true, city: true } },
        createdBy: { select: { name: true, userId: true } },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const items = list.map((q) => {
      const br = (q.result as { breakdown?: { inputs?: { systemSizeKw?: number } } } | null)?.breakdown;
      const systemKw = br?.inputs?.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
      return {
        id: q.id,
        quoteNumber: q.quoteNumber,
        version: q.version,
        customerName: q.customer.name,
        systemSizeKw: systemKw,
        location: [q.site.address, q.site.city].filter(Boolean).join(', ') || '—',
        date: q.createdAt,
        type: q.quotationType,
        createdBy: q.createdBy.name,
        createdByUserId: q.createdBy.userId,
        hasStoredPdf: !!q.generatedPdfPath,
      };
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

/** List quotations for a customer */
router.get('/customer/:customerId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotations = await prisma.quotation.findMany({
      where: { customerId: req.params.customerId },
      include: { site: { select: { id: true, name: true, address: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotations);
  } catch (err) { next(err); }
});

/** Delete a quotation */
router.delete(
  '/:id',
  authenticate,
  param('id').trim().notEmpty(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const q = await prisma.quotation.findUnique({
        where: { id: req.params.id },
        select: { id: true, generatedPdfPath: true },
      });
      if (!q) return res.status(404).json({ error: 'Quotation not found' });

      if (q.generatedPdfPath) {
        const filePath = join(UPLOADS_DIR, q.generatedPdfPath);
        if (existsSync(filePath)) {
          await unlink(filePath).catch(() => {});
        }
      }

      await prisma.quotation.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/** Get single quotation */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        site: true,
        createdBy: { select: { name: true } },
        materials: { include: { material: { select: { name: true, unit: true } } } },
        pricings: { include: { pricingType: true } },
        result: true,
      },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    res.json(q);
  } catch (err) { next(err); }
});

/** Auth for template-data: Bearer token OR valid pdf_token (for Puppeteer PDF generation) */
function templateDataAuth(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const pdfToken = req.query.pdf_token as string | undefined;
  if (pdfToken && req.params.id && validatePdfToken(req.params.id, pdfToken)) {
    return next();
  }
  return authenticate(req, res, next);
}

/** Structured data for the HTML/CSS quotation template */
router.get('/:id/template-data', templateDataAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotationId = req.params.id;
    if (!quotationId) {
      return res.status(400).json({ error: 'Quotation ID required' });
    }
    // Fetch quotation and matching template (by systemType + siteType)
    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        customer: true,
        site: true,
        result: true,
        materials: {
          include: { material: { select: { name: true, unit: true, specs: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    const { selectTemplateForQuotation } = await import('../services/template-selection.service.js');
    const sysType = (q.systemType ?? 'DCR') as 'DCR' | 'NON_DCR';
    const sitType = (q.siteType ?? 'RESIDENTIAL') as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
    const activeTemplate = await selectTemplateForQuotation(sysType, sitType);
    if (!q.result) {
      return res.status(400).json({
        error: 'Quotation not yet calculated. Please run the calculation first.',
      });
    }

    const breakdown  = (q.result.breakdown as Record<string, unknown>) ?? {};
    const inputs     = (breakdown.inputs      as Record<string, number>) ?? {};
    const costBreak  = (breakdown.costBreakdown as Record<string, number>) ?? {};
    const emiData    = (breakdown.emi as Record<string, Record<string, number>>) ?? {};

    const systemKw   = inputs.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
    const totalWatts = Math.round(systemKw * 1000);
    const panelWatt  = 575;
    const numPanels  = Math.ceil(totalWatts / panelWatt);

    const peakSun    = inputs.peakSunHours         ?? 5;
    const efficiency = inputs.systemEfficiency      ?? 0.8;
    const inflation  = inputs.gridInflationPct      ?? 3;
    const tariff     = inputs.electricityRatePerUnit ?? 8;

    const annualGenKwh = Math.round(systemKw * peakSun * 365 * efficiency);
    const annualSavYr1 = Math.round(annualGenKwh * tariff);

    let savings30Yr = 0;
    for (let y = 0; y < 30; y++) {
      savings30Yr += Math.round(annualSavYr1 * Math.pow(1 + inflation / 100, y));
    }

    const netCost    = costBreak.netCost       ?? q.totalAmount ?? 0;
    const baseCost   = costBreak.baseCost      ?? 0;
    const gstAmount  = costBreak.gstAmount     ?? 0;
    const grossCost  = costBreak.grossCost     ?? 0;
    const subsidy    = costBreak.subsidyAmount ?? 0;

    const emi3Yr = emiData.tenure3yr?.emi ?? 0;
    const emi5Yr = emiData.tenure5yr?.emi ?? 0;
    const emi7Yr = emiData.tenure7yr?.emi ?? 0;
    const emi3YrTotalPayable = emiData.tenure3yr?.totalPayable ?? emi3Yr * 36;
    const emi3YrTotalInterest = emiData.tenure3yr?.totalInterest ?? emi3Yr * 36 - Math.round(grossCost * 0.8);
    const emi5YrTotalPayable = emiData.tenure5yr?.totalPayable ?? emi5Yr * 60;
    const emi5YrTotalInterest = emiData.tenure5yr?.totalInterest ?? emi5Yr * 60 - Math.round(grossCost * 0.8);
    const emi7YrTotalPayable = emiData.tenure7yr?.totalPayable ?? emi7Yr * 84;
    const emi7YrTotalInterest = emiData.tenure7yr?.totalInterest ?? emi7Yr * 84 - Math.round(grossCost * 0.8);

    const now = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = `${now.getDate().toString().padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const materials = q.materials.map((qm, i) => ({
      srNo: i + 1,
      name: qm.material.name,
      specification: (qm.material.specs as string | null) ?? '',
      make: '',
      quantity: qm.quantity,
      unit: qm.material.unit,
    }));

    res.json({
      quoteNumber: q.quoteNumber,
      date: dateStr,
      validUntil: q.validUntil ? q.validUntil.toISOString().split('T')[0] : null,
      status: q.status,

      clientName: q.customer.name,
      clientAddress: q.site.address || q.customer.address || '',
      clientPhone: q.customer.phone ?? null,
      clientEmail: q.customer.email ?? null,
      contactPerson: q.customer.name,

      systemSizeKw: systemKw,
      systemSizeWatts: totalWatts,
      numModules: numPanels,
      inverterSizeKw: q.inverterSizeKw ?? systemKw,  // Default to system size if not set
      areaSquareFt: Math.round(systemKw * 80),  // 80 sq.ft per kW

      dailyProductionKwh: Math.round((annualGenKwh / 365) * 10) / 10,
      monthlyProductionKwh: Math.round(annualGenKwh / 12),
      annualProductionKwh: annualGenKwh,

      monthlySavingsRs: Math.round(annualSavYr1 / 12),
      annualSavingsRs: annualSavYr1,
      savings30YrRs: savings30Yr,

      breakevenYears: q.result.roiYears
        ? Math.round(q.result.roiYears * 10) / 10
        : 0,
      tariffPerUnit: tariff,
      gridInflationPct: inflation,

      baseCost,
      gstAmount,
      totalCost: grossCost,
      subsidyAmount: subsidy,
      netCost,

      emi3Yr,
      emi5Yr,
      emi7Yr,
      emi3YrTotalPayable,
      emi3YrTotalInterest,
      emi5YrTotalPayable,
      emi5YrTotalInterest,
      emi7YrTotalPayable,
      emi7YrTotalInterest,

      materials,

      // System/site type from quotation
      systemType: q.systemType,
      siteType:   q.siteType,
      showSubsidy:      q.systemType !== 'NON_DCR' && (q.siteType === 'RESIDENTIAL' || q.siteType === 'SOCIETY'),
      showDepreciation: q.systemType === 'NON_DCR' && (q.siteType === 'COMMERCIAL' || q.siteType === 'INDUSTRIAL'),

      // Sanctioned load
      sanctionedLoadKw: q.sanctionedLoadKw ?? null,

      // Depreciation data from active template
      depreciationTable: activeTemplate?.depreciationTable ?? [
        { year: 'Year 1', rate: '40%',  note: 'WDV accelerated depreciation' },
        { year: 'Year 2', rate: '24%',  note: '40% on remaining 60%' },
        { year: 'Year 3', rate: '14.4%',note: '40% on remaining 36%' },
        { year: 'Year 4+',rate: '8.6%', note: 'Diminishing balance' },
      ],
      depreciationNote: activeTemplate?.depreciationNote ?? 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules.',

      // Embed full template config so the frontend always uses the latest active version
      templateConfig: activeTemplate ?? null,
    });
  } catch (err) { next(err); }
});

/** Generate legacy DCR template PDF and save. Used when Puppeteer fails or as fallback. */
async function generateAndSaveLegacyPdf(
  q: { id: string; quoteNumber: string; version: number; customer: { name: string; address?: string | null; phone?: string | null }; site: { address: string }; totalWattage?: number | null; result: { breakdown: unknown; roiYears?: number | null } }
): Promise<{ relativePath: string; filename: string }> {
  const breakdown = (q.result.breakdown as Record<string, unknown>) ?? {};
  const inputs = (breakdown.inputs as Record<string, number>) ?? {};
  const costBreak = (breakdown.costBreakdown as Record<string, number>) ?? {};
  const systemKw = inputs.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
  const totalWatts = systemKw * 1000;
  const panelWatt = 575;
  const numPanels = Math.ceil(totalWatts / panelWatt);
  const areaPerPanel = 15;
  const peakSun = inputs.peakSunHours ?? 5;
  const efficiency = inputs.systemEfficiency ?? 0.8;
  const inflation = inputs.gridInflationPct ?? 3;
  const tariff = inputs.electricityRatePerUnit ?? 8;
  const annualGenKwh = systemKw * peakSun * 365 * efficiency;
  const annualSavYr1 = Math.round(annualGenKwh * tariff);
  const savings30yr = calc30YrSavings(annualSavYr1, inflation);
  const netCost = costBreak.netCost ?? 0;
  const baseCost = costBreak.baseCost ?? 0;
  const gstAmount = costBreak.gstAmount ?? 0;
  const grossCost = costBreak.grossCost ?? 0;
  const subsidy = costBreak.subsidyAmount ?? 0;
  const emiDataPdf = breakdown.emi as Record<string, { emi?: number }> | undefined;
  const loanRate = inputs.emiRatePct ?? 9;
  const a1 = emiDataPdf?.tenure3yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 36);
  const a2 = emiDataPdf?.tenure5yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 60);
  const a3 = emiDataPdf?.tenure7yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 84);
  const fmtInr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const payback = q.result.roiYears ? Math.round(q.result.roiYears * 10) / 10 : 0;
  const monthlySavingsRs = Math.round(annualSavYr1 / 12);
  const values: PdfValues = {
    x1: String(systemKw), x2: String(Math.round(totalWatts)), x3: dateStr,
    x4: q.customer.name, x5: q.site.address || (q.customer.address ?? ''), x6: q.customer.phone || q.customer.name,
    y1: String(numPanels), y2: String(numPanels * areaPerPanel), y3: String(Math.round(annualGenKwh / 12)),
    y4: String(Math.round((annualGenKwh / 365) * 10) / 10), y5: fmtInr(monthlySavingsRs), y6: fmtInr(annualSavYr1),
    y7: String(payback), y8: fmtInr(savings30yr),
    z1: fmtInr(baseCost), z2: fmtInr(gstAmount), z3: fmtInr(grossCost), z4: fmtInr(subsidy), z5: fmtInr(netCost),
    a1: fmtInr(a1), a2: fmtInr(a2), a3: fmtInr(a3),
  };
  const pdfBytes = await generateFilledPdf(values);
  await mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${q.quoteNumber}_v${q.version}.pdf`;
  const relativePath = filename;
  await writeFile(join(UPLOADS_DIR, relativePath), Buffer.from(pdfBytes));
  await prisma.quotation.update({ where: { id: q.id }, data: { generatedPdfPath: relativePath } });
  return { relativePath, filename };
}

/** Generate quotation PDF via Puppeteer (HTML template → PDF). Falls back to legacy DCR PDF if Puppeteer fails. */
router.post('/:id/generate-pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { customer: true, site: true, result: true },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    if (!q.result) {
      return res.status(400).json({
        error: 'Quotation not yet calculated. Please run the calculation first.',
      });
    }

    let result: { relativePath: string; filename: string };
    try {
      result = await generateQuotationPdf({
        quotationId: q.id,
        quoteNumber: q.quoteNumber,
        version: q.version,
      });
      await prisma.quotation.update({
        where: { id: q.id },
        data: { generatedPdfPath: result.relativePath },
      });
    } catch (puppeteerErr) {
      console.warn('[PDF] Puppeteer failed, using legacy PDF:', (puppeteerErr as Error).message);
      result = await generateAndSaveLegacyPdf(q as Parameters<typeof generateAndSaveLegacyPdf>[0]);
    }

    res.json({
      ok: true,
      generatedPdfPath: result.relativePath,
      filename: result.filename,
    });
  } catch (err) {
    next(err);
  }
});

/** Quick Quotation — create customer, site, quotation, and run calculation in one request */
router.post(
  '/quick',
  authenticate,
  [
    body('customerName').trim().notEmpty().withMessage('customerName required'),
    body('address').trim().notEmpty().withMessage('address required'),
    body('systemType').isIn(['DCR', 'NON_DCR']).withMessage('systemType must be DCR or NON_DCR'),
    body('siteType').isIn(['RESIDENTIAL', 'SOCIETY', 'COMMERCIAL', 'INDUSTRIAL']).withMessage('invalid siteType'),
    body('systemSizeKw').isFloat({ min: 0.5 }).withMessage('systemSizeKw required (minimum 0.5 kW)'),
    body('pricePerWatt').isFloat({ min: 1 }).withMessage('pricePerWatt required (₹ per W)'),
    body('electricityRatePerUnit').isFloat({ min: 1 }).withMessage('electricityRatePerUnit required (₹/kWh)'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        customerName, address, city, phone, email,
        systemType = 'DCR', siteType = 'RESIDENTIAL',
        systemSizeKw,
        inverterSizeKw,
        pricePerWatt,
        electricityRatePerUnit,
        peakSunHours = 5,
        gstPct = 8.9,
        emiRatePct = 9,
        sanctionedLoadKw,
        notes,
      } = req.body;

      const userId = req.user!.userId;

      const quoteNum = await generateQTNumber();

      const { customer, site, quotation } = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            name: customerName.trim(),
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            address: address.trim(),
            city: city?.trim() || null,
            createdById: userId,
          },
        });
        const site = await tx.site.create({
          data: {
            customerId: customer.id,
            address: address.trim(),
            city: city?.trim() || null,
          },
        });
        const quotation = await tx.quotation.create({
          data: {
            customerId: customer.id,
            siteId: site.id,
            quoteNumber: quoteNum,
            notes: notes?.trim() || null,
            createdById: userId,
            status: 'DRAFT',
            quotationType: 'QUICK',
            systemType,
            siteType,
            sanctionedLoadKw: sanctionedLoadKw ? parseFloat(sanctionedLoadKw) : null,
            inverterSizeKw: (inverterSizeKw != null && parseFloat(inverterSizeKw) > 0)
              ? parseFloat(inverterSizeKw) : parseFloat(systemSizeKw),
          },
        });
        return { customer, site, quotation };
      });

      await calculateQuotation(quotation.id, {
        systemSizeKw:           parseFloat(systemSizeKw),
        pricePerWatt:           parseFloat(pricePerWatt),
        profitMarginPct:        0,
        gstPct:                 parseFloat(gstPct),
        electricityRatePerUnit: parseFloat(electricityRatePerUnit),
        peakSunHours:           parseFloat(peakSunHours),
        systemEfficiency:       1,
        emiRatePct:             parseFloat(emiRatePct),
        systemType,
        siteType,
        notes: notes?.trim(),
      }, userId);

      // Store snapshot for edit/replay
      const qWithResult = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: { result: true },
      });
      if (qWithResult?.result) {
        const br = (qWithResult.result.breakdown as Record<string, unknown>) ?? {};
        const inputs = (br.inputs as Record<string, unknown>) ?? {};
        const cb = (br.costBreakdown as Record<string, unknown>) ?? {};
        await prisma.quotation.update({
          where: { id: quotation.id },
          data: {
            quotationDataJson: JSON.parse(JSON.stringify({
              inputs,
              costBreakdown: cb,
              formData: {
                pricePerWatt,
                electricityRatePerUnit: parseFloat(electricityRatePerUnit),
                systemSizeKw: parseFloat(systemSizeKw),
                inverterSizeKw: (inverterSizeKw != null && parseFloat(inverterSizeKw) > 0)
                  ? parseFloat(inverterSizeKw) : parseFloat(systemSizeKw),
                systemType,
                siteType,
                sanctionedLoadKw: sanctionedLoadKw ? parseFloat(sanctionedLoadKw) : null,
              },
            })) as object,
          },
        });
      }

      res.status(201).json({
        quotationId:  quotation.id,
        quoteNumber:  quotation.quoteNumber,
        customerId:   customer.id,
        printUrl:     `/quotation/${quotation.id}/print`,
      });
    } catch (err) { next(err); }
  }
);

/** Create quotation (triggered from sales dashboard) */
router.post(
  '/',
  authenticate,
  [
    body('customerId').trim().notEmpty().withMessage('customerId required'),
    body('siteId').trim().notEmpty().withMessage('siteId required'),
    body('notes').optional().trim(),
    body('validUntil').optional().isISO8601(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const [customer, site] = await Promise.all([
        prisma.customer.findUnique({ where: { id: req.body.customerId } }),
        prisma.site.findUnique({ where: { id: req.body.siteId } }),
      ]);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      if (!site) return res.status(404).json({ error: 'Site not found' });
      if (site.customerId !== req.body.customerId) return res.status(400).json({ error: 'Site does not belong to customer' });

      const quoteNum = await generateQTNumber();

      const quotation = await prisma.quotation.create({
        data: {
          customerId: req.body.customerId,
          siteId: req.body.siteId,
          quoteNumber: quoteNum,
          quotationType: 'NORMAL',
          notes: req.body.notes,
          validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
          createdById: req.user!.userId,
          status: 'DRAFT',
        },
        include: {
          customer: { select: { name: true } },
          site: { select: { name: true, address: true } },
          createdBy: { select: { name: true } },
        },
      });
      res.status(201).json(quotation);
    } catch (err) { next(err); }
  }
);

/** Calculate quotation – sizing, cost, ROI, EMI */
router.post(
  '/:id/calculate',
  authenticate,
  [
    body('pricePerWatt').isFloat({ min: 0 }).withMessage('pricePerWatt required (₹ per W)'),
    body('electricityRatePerUnit').isFloat({ min: 0 }).withMessage('electricityRatePerUnit required (₹ per kWh)'),
    body('systemSizeKw').optional().isFloat({ min: 0.5 }),
    body('profitMarginPct').optional().isFloat({ min: 0, max: 100 }),
    body('gstPct').optional().isFloat({ min: 0, max: 100 }),
    body('subsidyAmountOverride').optional().isFloat({ min: 0 }),
    body('gridInflationPct').optional().isFloat({ min: 0 }),
    body('peakSunHours').optional().isFloat({ min: 1, max: 12 }),
    body('systemEfficiency').optional().isFloat({ min: 0.1, max: 1 }),
    body('systemLifeYears').optional().isInt({ min: 1, max: 50 }),
    body('emiRatePct').optional().isFloat({ min: 0, max: 50 }),
    body('notes').optional().trim(),
    body('systemType').optional().isIn(['DCR', 'NON_DCR']).withMessage('systemType must be DCR or NON_DCR'),
    body('siteType').optional().isIn(['RESIDENTIAL', 'SOCIETY', 'COMMERCIAL', 'INDUSTRIAL']).withMessage('siteType must be RESIDENTIAL, SOCIETY, COMMERCIAL, or INDUSTRIAL'),
    body('sanctionedLoadKw').optional().isFloat({ min: 0 }),
    body('inverterSizeKw').optional().isFloat({ min: 0.5 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      // Persist quotation-level fields if provided
      const updateData: Record<string, unknown> = {};
      if (req.body.sanctionedLoadKw !== undefined) {
        updateData.sanctionedLoadKw = parseFloat(req.body.sanctionedLoadKw) || null;
      }
      if (req.body.inverterSizeKw !== undefined) {
        updateData.inverterSizeKw = parseFloat(req.body.inverterSizeKw) || null;
      } else if (req.body.systemSizeKw !== undefined) {
        // Default: inverter = system size only when inverter was never set (user has not manually edited)
        const q = await prisma.quotation.findUnique({
          where: { id: req.params.id },
          select: { inverterSizeKw: true },
        });
        if (q?.inverterSizeKw == null) {
          const sysKw = parseFloat(req.body.systemSizeKw);
          if (sysKw > 0) updateData.inverterSizeKw = sysKw;
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.quotation.update({
          where: { id: req.params.id },
          data: updateData,
        });
      }

      const result = await calculateQuotation(req.params.id, req.body, req.user!.userId);

      // Store snapshot for edit/replay (Saved Quotations)
      const snapshot = {
        inputs: result.inputs,
        costBreakdown: {
          baseCost: result.baseCost,
          profitAmount: result.profitAmount,
          preTaxCost: result.preTaxCost,
          gstAmount: result.gstAmount,
          grossCost: result.grossCost,
          subsidyAmount: result.subsidyAmount,
          netCost: result.netCost,
        },
        formData: {
          pricePerWatt: req.body.pricePerWatt,
          electricityRatePerUnit: req.body.electricityRatePerUnit,
          systemSizeKw: req.body.systemSizeKw,
          inverterSizeKw: req.body.inverterSizeKw ?? result.inputs.systemSizeKw,
          profitMarginPct: req.body.profitMarginPct,
          gstPct: req.body.gstPct,
          systemType: req.body.systemType,
          siteType: req.body.siteType,
          sanctionedLoadKw: req.body.sanctionedLoadKw,
          gridInflationPct: req.body.gridInflationPct,
          peakSunHours: req.body.peakSunHours,
          systemEfficiency: req.body.systemEfficiency,
          systemLifeYears: req.body.systemLifeYears,
          emiRatePct: req.body.emiRatePct,
        },
      };
      await prisma.quotation.update({
        where: { id: req.params.id },
        data: { quotationDataJson: snapshot as object },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Debug: inspect how placeholder text is stored in the template PDF.
 * GET /api/quotations/debug-template
 * Returns a JSON snapshot of up to 200 bytes around each found encoding.
 */
router.get('/debug-template', authenticate, async (_req, res, next) => {
  try {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const { inflateSync } = await import('zlib');
    const { PDFDocument, PDFName } = await import('pdf-lib');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const templatePath = resolve(__dirname, '../../../../DCR Quotation Template.pdf');
    const nodeBuf = readFileSync(templatePath);
    const cleanBuf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
    const pdfDoc = await PDFDocument.load(cleanBuf, { ignoreEncryption: true });
    const ctx = (pdfDoc as any).context as { indirectObjects: Map<unknown, unknown> };

    const results: Record<string, unknown> = {};
    let streamIdx = 0;

    for (const [, raw] of ctx.indirectObjects) {
      const obj = raw as any;
      if (!(obj?.contents instanceof Uint8Array)) continue;
      if (!obj.dict) continue;

      const subtype = String(obj.dict.get?.(PDFName.of('Subtype')) ?? '');
      if (subtype === '/Image') continue;

      let decompressed: Buffer;
      try { decompressed = inflateSync(Buffer.from(obj.contents)); }
      catch { decompressed = Buffer.from(obj.contents); }

      const latin1 = decompressed.toString('latin1');
      const ascii  = decompressed.toString('ascii');

      // Check for x1 in various encodings
      const checks: Record<string, boolean | string | number> = {
        ascii_literal:   latin1.includes('x1'),
        ucs2_literal:    latin1.includes('\x00x\x001'),
        hex_upper:       latin1.includes('<0078'),
        hex_lower:       latin1.includes('<0078'.toLowerCase()),
        length:          decompressed.length,
      };

      // Show context snippet if any encoding found
      if (checks.ascii_literal || checks.ucs2_literal) {
        const idx = latin1.indexOf(checks.ascii_literal ? 'x1' : '\x00x\x001');
        checks.context_hex = Buffer.from(
          latin1.slice(Math.max(0, idx - 10), idx + 30), 'latin1'
        ).toString('hex');
        checks.context_ascii = ascii.slice(Math.max(0, idx - 10), idx + 30);
      }

      if (Object.values(checks).some(v => v === true)) {
        results[`stream_${streamIdx}`] = checks;
      }
      streamIdx++;
    }

    res.json({ streamCount: streamIdx, found: results });
  } catch (err) { next(err); }
});

/** Download quotation PDF — serve stored file if available, else generate DCR template */
router.get('/:id/pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      select: { id: true, generatedPdfPath: true, quoteNumber: true },
    });

    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    // Serve stored PDF if available (from Saved Quotations)
    if (q.generatedPdfPath) {
      const filePath = join(UPLOADS_DIR, q.generatedPdfPath);
      if (existsSync(filePath)) {
        const buf = await readFile(filePath);
        const filename = q.generatedPdfPath.includes('/') ? q.generatedPdfPath.split('/').pop()! : q.generatedPdfPath;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', String(buf.length));
        return res.end(buf);
      }
    }

    // Fallback: generate DCR template PDF (legacy)
    const qFull = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      include: { customer: true, site: true, result: true },
    });
    if (!qFull) return res.status(404).json({ error: 'Quotation not found' });
    if (!qFull.result) {
      return res.status(400).json({
        error: 'Quotation not yet calculated. Please run the calculation first.',
      });
    }

    // ── Unpack stored breakdown ──────────────────────────────────────────
    const breakdown  = (qFull.result!.breakdown as Record<string, unknown>) ?? {};
    const inputs     = (breakdown.inputs      as Record<string, number>) ?? {};
    const costBreak  = (breakdown.costBreakdown as Record<string, number>) ?? {};

    const systemKw     = inputs.systemSizeKw ?? (qFull.totalWattage ? qFull.totalWattage / 1000 : 0);
    const totalWatts   = systemKw * 1000;
    const panelWatt    = 575;
    const numPanels    = Math.ceil(totalWatts / panelWatt);
    const areaPerPanel = 15;                              // sq ft per 575W panel

    const peakSun    = inputs.peakSunHours         ?? 5;
    const efficiency = inputs.systemEfficiency      ?? 0.8;
    const inflation  = inputs.gridInflationPct      ?? 3;
    const tariff     = inputs.electricityRatePerUnit ?? 8;

    const annualGenKwh = systemKw * peakSun * 365 * efficiency;
    const annualSavYr1 = Math.round(annualGenKwh * tariff);
    const savings30yr  = calc30YrSavings(annualSavYr1, inflation);

    const netCost   = costBreak.netCost       ?? qFull.totalAmount ?? 0;
    const baseCost  = costBreak.baseCost      ?? 0;
    const gstAmount = costBreak.gstAmount     ?? 0;
    const grossCost = costBreak.grossCost     ?? 0;
    const subsidy   = costBreak.subsidyAmount ?? 0;

    // EMI: use values from breakdown (reducing balance, 80% of total cost pre-subsidy) or recalc
    const emiDataPdf = breakdown.emi as Record<string, { emi?: number }> | undefined;
    const loanRate = inputs.emiRatePct ?? 9;
    const a1 = emiDataPdf?.tenure3yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 36);
    const a2 = emiDataPdf?.tenure5yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 60);
    const a3 = emiDataPdf?.tenure7yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 84);

    const fmtInr = (n: number) =>
      n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    // Date in d/m/yyyy format matching the sample: "1/3/2026"
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

    const payback = qFull.result!.roiYears
      ? Math.round(qFull.result!.roiYears * 10) / 10
      : 0;

    // Formatted Monthly savings (₹ amount, not kWh units)
    const monthlySavingsRs = Math.round(annualSavYr1 / 12);

    const values: PdfValues = {
      // ── System ──────────────────────────────────────────────────────
      x1: String(systemKw),
      x2: String(Math.round(totalWatts)),
      x3: dateStr,
      x4: qFull.customer.name,
      x5: qFull.site.address || (qFull.customer.address ?? ''),
      x6: qFull.customer.phone || qFull.customer.name,
      // ── Generation & Savings ────────────────────────────────────────
      y1: String(numPanels),
      y2: String(numPanels * areaPerPanel),
      y3: String(Math.round(annualGenKwh / 12)),
      y4: String(Math.round((annualGenKwh / 365) * 10) / 10),
      y5: fmtInr(monthlySavingsRs),
      y6: fmtInr(annualSavYr1),
      y7: String(payback),
      y8: fmtInr(savings30yr),
      // ── Cost Breakdown ──────────────────────────────────────────────
      z1: fmtInr(baseCost),
      z2: fmtInr(gstAmount),
      z3: fmtInr(grossCost),
      z4: fmtInr(subsidy),
      z5: fmtInr(netCost),
      // ── EMI (80% loan at 10%, tenures 3/5/7 yr) ─────────────────────
      a1: fmtInr(a1),
      a2: fmtInr(a2),
      a3: fmtInr(a3),
    };

    const pdfBytes = await generateFilledPdf(values);

    // Auto-save generated PDF for future direct download (legacy fallback uses {quoteNumber}_v{version}.pdf)
    if (!qFull.generatedPdfPath) {
      try {
        await mkdir(UPLOADS_DIR, { recursive: true });
        const version = (qFull as { version?: number }).version ?? 1;
        const filename = `${qFull.quoteNumber}_v${version}.pdf`;
        await writeFile(join(UPLOADS_DIR, filename), Buffer.from(pdfBytes));
        await prisma.quotation.update({
          where: { id: qFull.id },
          data: { generatedPdfPath: filename },
        });
      } catch { /* non-blocking */ }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${qFull.quoteNumber}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));
  } catch (err) {
    next(err);
  }
});

/** Store uploaded PDF for a quotation (served directly on download) */
router.post('/:id/store-pdf', authenticate, pdfUpload.single('pdf'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = req.params.id!;
    const file = (req as { file?: { buffer: Buffer } }).file;
    if (!file?.buffer) return res.status(400).json({ error: 'No PDF file uploaded' });

    const q = await prisma.quotation.findUnique({ where: { id } });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${id}.pdf`;
    const filepath = join(UPLOADS_DIR, filename);
    await writeFile(filepath, file.buffer);

    await prisma.quotation.update({
      where: { id },
      data: { generatedPdfPath: filename },
    });

    res.json({ ok: true, generatedPdfPath: filename });
  } catch (err) {
    next(err);
  }
});

/** Create new version from edited quotation data */
router.post('/:id/create-version', authenticate, [
  body('formData').isObject(),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = req.params.id!;
    const formData = req.body.formData as Record<string, unknown>;
    const userId = req.user!.userId;

    const parent = await prisma.quotation.findUnique({
      where: { id },
      include: { customer: true, site: true, result: true },
    });
    if (!parent) return res.status(404).json({ error: 'Quotation not found' });
    if (!parent.result) return res.status(400).json({ error: 'Parent quotation has no calculation result' });

    const nextVersion = (parent.version ?? 1) + 1;
    const baseNumber = parent.quoteNumber.replace(/-\s*v\d+$/i, '');
    const newQuoteNumber = `${baseNumber}-v${nextVersion}`;

    const fd = formData;
    const num = (v: unknown) => (v != null && v !== '' ? parseFloat(String(v)) : undefined);
    const calcInput = {
      systemSizeKw: num(fd.systemSizeKw) ?? num(fd.system_size_kw),
      pricePerWatt: num(fd.pricePerWatt) ?? num(fd.price_per_watt) ?? 0,
      profitMarginPct: num(fd.profitMarginPct) ?? num(fd.profit_margin_pct) ?? 0,
      gstPct: num(fd.gstPct) ?? num(fd.gst_pct) ?? 8.9,
      electricityRatePerUnit: num(fd.electricityRatePerUnit) ?? num(fd.electricity_rate_per_unit) ?? 0,
      gridInflationPct: num(fd.gridInflationPct) ?? num(fd.grid_inflation_pct),
      peakSunHours: num(fd.peakSunHours) ?? num(fd.peak_sun_hours),
      systemEfficiency: num(fd.systemEfficiency) ?? num(fd.system_efficiency),
      emiRatePct: num(fd.emiRatePct) ?? num(fd.emi_rate_pct),
      systemType: (fd.systemType ?? fd.system_type ?? parent.systemType) as 'DCR' | 'NON_DCR',
      siteType: (fd.siteType ?? fd.site_type ?? parent.siteType) as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL',
      notes: typeof fd.notes === 'string' ? fd.notes : undefined,
    };

    const newQuotation = await prisma.quotation.create({
      data: {
        customerId: parent.customerId,
        siteId: parent.siteId,
        quoteNumber: newQuoteNumber,
        version: nextVersion,
        parentQuotationId: parent.id,
        quotationType: parent.quotationType,
        systemType: parent.systemType,
        siteType: parent.siteType,
        status: 'DRAFT',
        createdById: req.user!.userId,
      },
    });

    const { calculateQuotation } = await import('../services/quotation.service.js');
    const result = await calculateQuotation(newQuotation.id, calcInput, userId);

    await prisma.quotation.update({
      where: { id: newQuotation.id },
      data: {
        quotationDataJson: {
          inputs: result.inputs,
          costBreakdown: {
            baseCost: result.baseCost,
            profitAmount: result.profitAmount,
            preTaxCost: result.preTaxCost,
            gstAmount: result.gstAmount,
            grossCost: result.grossCost,
            subsidyAmount: result.subsidyAmount,
            netCost: result.netCost,
          },
          formData,
        } as object,
      },
    });

    const updated = await prisma.quotation.findUnique({ where: { id: newQuotation.id } });
    res.json({
      id: updated!.id,
      quoteNumber: updated!.quoteNumber,
      version: updated!.version,
      totalAmount: result.netCost,
    });
  } catch (err) {
    next(err);
  }
});

/** Update quotation status */
router.patch('/:id/status', authenticate, [
  body('status').isIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const q = await prisma.quotation.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    res.json(q);
  } catch (err) { next(err); }
});

export default router;
