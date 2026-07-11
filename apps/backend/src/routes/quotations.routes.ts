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
import { ROI_DAYS_PER_YEAR } from '../constants/roi-generation.js';
import { generateFilledPdf, calc30YrSavings, calcLoanEmi, type PdfValues } from '../services/pdf.service.js';
import { generateQuotationPdf, generateQuotationPdfBuffer } from '../services/pdf-generation.service.js';

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

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
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

/** Auth for template-data (used by frontend print preview) */
const templateDataAuth = authenticate;

/** Structured data for the HTML/CSS quotation template */
router.get('/:id/template-data', templateDataAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quotationId = req.params.id;
    if (!quotationId) {
      return res.status(400).json({ error: 'Quotation ID required' });
    }

    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, result: true },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    if (!q.result) {
      return res.status(400).json({
        error: 'Quotation not yet calculated. Please run the calculation first.',
      });
    }

    const { getQuotationTemplateData } = await import('../services/quotation-template-data.service.js');
    const data = await getQuotationTemplateData(quotationId);
    if (!data) return res.status(404).json({ error: 'Quotation not found' });

    res.json(data);
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
  const peakSun = inputs.peakSunHours ?? 4;
  const efficiency = inputs.systemEfficiency ?? 0.8;
  const inflation = inputs.gridInflationPct ?? 3;
  const tariff = inputs.electricityRatePerUnit ?? 18;
  const annualGenKwh = systemKw * peakSun * ROI_DAYS_PER_YEAR * efficiency;
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
  const a2 = emiDataPdf?.tenure5yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 48);
  const a3 = emiDataPdf?.tenure7yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 60);
  const fmtInr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const now = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const payback = q.result.roiYears ? Math.round(q.result.roiYears * 10) / 10 : 0;
  const monthlySavingsRs = Math.round(annualSavYr1 / 12);
  const values: PdfValues = {
    x1: String(systemKw), x2: String(Math.round(totalWatts)), x3: dateStr,
    x4: q.customer.name, x5: q.site.address || (q.customer.address ?? ''), x6: q.customer.phone || q.customer.name,
    y1: String(numPanels), y2: String(numPanels * areaPerPanel), y3: String(Math.round(annualGenKwh / 12)),
    y4: String(Math.round((annualGenKwh / ROI_DAYS_PER_YEAR) * 10) / 10), y5: fmtInr(monthlySavingsRs), y6: fmtInr(annualSavYr1),
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
    body('electricityRatePerUnit').isFloat({ min: 1 }).withMessage('electricityRatePerUnit required (₹/kWh)'),
    body('quotationMode').optional().isIn(['SINGLE', 'COMBINED']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        customerName, address, city, phone, email,
        systemType = 'DCR', siteType = 'RESIDENTIAL',
        quotationMode = 'SINGLE',
        combinedSingleCosting: combinedSingleCostingBody = false,
        systems: systemsBody,
        systemSizeKw: systemSizeKwBody,
        inverterSizeKw,
        pricePerWatt: pricePerWattBody,
        electricityRatePerUnit,
        peakSunHours = 4,
        gstPct = 8.9,
        emiRatePct = 9,
        sanctionedLoadKw,
        sanctionedLoadIncreasedToKw,
        buildingHeight,
        buildingHeightCustomFloors,
        meterPhase,
        panelWattage,
        panelWattageCustom,
        structureCategory,
        structureOption,
        panelWarrantyYears,
        warrantyItems,
        bomItems,
        paymentMilestones,
        paymentModes,
        paymentTermsBullets,
        proposalNote,
        siteCosting,
        sitePhotos,
        profitMarginPct: profitMarginPctBody,
        notes,
        costingOptions: costingOptionsBody,
      } = req.body;

      const { calculateCombinedSystems } = await import('../services/combined-quotation.service.js');
      const { calculateCostingOptions } = await import('../services/costing-options.service.js');

      let resolvedSystemType = systemType as 'DCR' | 'NON_DCR';
      let resolvedSiteType = siteType as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';

      let systemSizeKw = systemSizeKwBody;
      let pricePerWatt = pricePerWattBody;
      let combinedSystemsCalc: Awaited<ReturnType<typeof calculateCombinedSystems>> | null = null;

      if (quotationMode === 'COMBINED') {
        const singleCosting = Boolean(combinedSingleCostingBody);
        if (!Array.isArray(systemsBody) || systemsBody.length < 2) {
          return res.status(400).json({ error: 'Combined quotation requires at least 2 systems' });
        }
        if (systemsBody.length > 6) {
          return res.status(400).json({ error: 'Combined quotation supports at most 6 systems' });
        }
        const combinedPpw = parseFloat(String(pricePerWattBody));
        if (singleCosting && (!Number.isFinite(combinedPpw) || combinedPpw < 1)) {
          return res.status(400).json({ error: 'Combined single costing requires pricePerWatt (₹ per W)' });
        }
        const parsedSystems: {
          label: string;
          consumerNumber: string;
          systemSizeKw: number;
          pricePerWatt: number;
          siteType?: string;
          meterPhase?: string;
          structureCategory?: string;
          structureOption?: string;
          sanctionedLoadKw?: number | null;
          sanctionedLoadIncreasedToKw?: number | null;
        }[] = [];
        for (let i = 0; i < systemsBody.length; i++) {
          const s = systemsBody[i] as Record<string, unknown>;
          const kw = parseFloat(String(s.systemSizeKw));
          const ppw = singleCosting
            ? combinedPpw
            : parseFloat(String(s.pricePerWatt));
          if (!Number.isFinite(kw) || kw < 0.5) {
            return res.status(400).json({ error: `System ${i + 1}: invalid capacity (min 0.5 kW)` });
          }
          if (!singleCosting && (!Number.isFinite(ppw) || ppw < 1)) {
            return res.status(400).json({ error: `System ${i + 1}: invalid price per watt` });
          }
          const sysSite = s.siteType ? String(s.siteType) : siteType;
          if (!['RESIDENTIAL', 'COMMERCIAL'].includes(sysSite)) {
            return res.status(400).json({ error: `System ${i + 1}: connection type must be Residential or Commercial` });
          }
          const parseSanctionedLoad = (v: unknown): number | null => {
            if (v === undefined || v === null || String(v).trim() === '') return null;
            const n = parseFloat(String(v));
            return Number.isFinite(n) && n >= 0 ? n : null;
          };
          const sysSanctionedLoad = parseSanctionedLoad(s.sanctionedLoadKw);
          const sysSanctionedIncreased =
            parseSanctionedLoad(s.sanctionedLoadIncreasedToKw) ?? (kw > 0 ? kw : null);

          parsedSystems.push({
            label: String(s.label ?? `System ${i + 1}`),
            consumerNumber: s.consumerNumber ? String(s.consumerNumber) : '',
            systemSizeKw: kw,
            pricePerWatt: ppw,
            siteType: sysSite,
            meterPhase: s.meterPhase ? String(s.meterPhase) : 'SINGLE',
            structureCategory: s.structureCategory ? String(s.structureCategory) : 'STANDARD',
            structureOption: s.structureOption ? String(s.structureOption) : '1ft',
            sanctionedLoadKw: sysSanctionedLoad,
            sanctionedLoadIncreasedToKw: sysSanctionedIncreased,
          });
        }
        combinedSystemsCalc = calculateCombinedSystems(parsedSystems, {
          systemType,
          siteType,
          electricityRatePerUnit: parseFloat(electricityRatePerUnit),
          peakSunHours: parseFloat(peakSunHours),
          singleCosting,
          combinedPricePerWatt: singleCosting ? combinedPpw : undefined,
        });
        systemSizeKw = combinedSystemsCalc.combined.systemSizeKw;
        pricePerWatt = combinedSystemsCalc.combined.blendedPricePerWatt;
      } else {
        const kw = parseFloat(systemSizeKwBody);
        const ppw = parseFloat(pricePerWattBody);
        if (!Number.isFinite(kw) || kw < 0.5) {
          return res.status(400).json({ error: 'systemSizeKw required (minimum 0.5 kW)' });
        }
        if (!Number.isFinite(ppw) || ppw < 1) {
          return res.status(400).json({ error: 'pricePerWatt required (₹ per W)' });
        }
        systemSizeKw = kw;
        pricePerWatt = ppw;
      }

      let costingOptionsCalc: Awaited<ReturnType<typeof calculateCostingOptions>> | null = null;
      if (Array.isArray(costingOptionsBody) && costingOptionsBody.length > 0) {
        if (costingOptionsBody.length > 4) {
          return res.status(400).json({ error: 'Maximum 4 costing options allowed' });
        }
        const parsedCostingInputs: {
          title: string;
          systemType: 'DCR' | 'NON_DCR';
          siteType: 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
          pricePerWatt: number;
        }[] = [];
        for (let i = 0; i < costingOptionsBody.length; i++) {
          const o = costingOptionsBody[i] as Record<string, unknown>;
          const title = String(o.title ?? '').trim();
          const ppw = parseFloat(String(o.pricePerWatt));
          const optSystemType = String(o.systemType ?? resolvedSystemType);
          const optSiteType = String(o.siteType ?? resolvedSiteType);
          if (!title && costingOptionsBody.length > 1) {
            return res.status(400).json({ error: `Costing option ${i + 1}: title is required` });
          }
          if (!Number.isFinite(ppw) || ppw < 1) {
            return res.status(400).json({ error: `Costing option ${i + 1}: invalid price per watt` });
          }
          if (!['DCR', 'NON_DCR'].includes(optSystemType)) {
            return res.status(400).json({ error: `Costing option ${i + 1}: invalid system type` });
          }
          if (!['RESIDENTIAL', 'SOCIETY', 'COMMERCIAL', 'INDUSTRIAL'].includes(optSiteType)) {
            return res.status(400).json({ error: `Costing option ${i + 1}: invalid site type` });
          }
          parsedCostingInputs.push({
            title,
            systemType: optSystemType as 'DCR' | 'NON_DCR',
            siteType: optSiteType as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL',
            pricePerWatt: ppw,
          });
        }
        costingOptionsCalc = calculateCostingOptions(parsedCostingInputs, parseFloat(String(systemSizeKw)));
        if (!costingOptionsCalc.length) {
          return res.status(400).json({ error: 'Could not calculate costing options' });
        }
        resolvedSystemType = costingOptionsCalc[0].systemType;
        resolvedSiteType = costingOptionsCalc[0].siteType;
        pricePerWatt = costingOptionsCalc[0].pricePerWatt;
      }

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
            systemType: resolvedSystemType,
            siteType: resolvedSiteType,
            sanctionedLoadKw:
              quotationMode === 'COMBINED'
                ? null
                : sanctionedLoadKw
                  ? parseFloat(sanctionedLoadKw)
                  : null,
            sanctionedLoadIncreasedToKw:
              quotationMode === 'COMBINED'
                ? null
                : sanctionedLoadIncreasedToKw !== undefined &&
                    sanctionedLoadIncreasedToKw !== null &&
                    String(sanctionedLoadIncreasedToKw).trim() !== '' &&
                    Number.isFinite(parseFloat(String(sanctionedLoadIncreasedToKw)))
                  ? parseFloat(String(sanctionedLoadIncreasedToKw))
                  : null,
            inverterSizeKw: (inverterSizeKw != null && parseFloat(inverterSizeKw) > 0)
              ? parseFloat(inverterSizeKw) : parseFloat(systemSizeKw),
          },
        });
        return { customer, site, quotation };
      });

      const profitMarginPct =
        profitMarginPctBody != null && Number.isFinite(parseFloat(String(profitMarginPctBody)))
          ? parseFloat(String(profitMarginPctBody))
          : 0;

      await calculateQuotation(quotation.id, {
        systemSizeKw:           parseFloat(systemSizeKw),
        pricePerWatt:           parseFloat(pricePerWatt),
        profitMarginPct,
        gstPct:                 parseFloat(gstPct),
        electricityRatePerUnit: parseFloat(electricityRatePerUnit),
        peakSunHours:           parseFloat(peakSunHours),
        systemEfficiency:       1,
        emiRatePct:             parseFloat(emiRatePct),
        systemType:           resolvedSystemType,
        siteType:             resolvedSiteType,
        notes: notes?.trim(),
      }, userId);

      // Store snapshot for edit/replay
      const qWithResult = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        include: { result: true },
      });
      if (qWithResult?.result) {
        const { buildQuickQuoteDisplayConfig } = await import('../services/quick-quote-config.service.js');
        const { parseBomItemsFromBody, serializeBomItemsForStorage } = await import('../services/bom-items.service.js');
        const { parseWarrantyItemsFromBody, serializeWarrantyItemsForStorage } = await import('../services/warranty-items.service.js');
        const br = (qWithResult.result.breakdown as Record<string, unknown>) ?? {};
        const inputs = (br.inputs as Record<string, unknown>) ?? {};
        const cb = (br.costBreakdown as Record<string, unknown>) ?? {};
        const sysKw = parseFloat(systemSizeKw);
        const quickConfig = {
          buildingHeight: buildingHeight ?? 'G',
          buildingHeightCustomFloors:
            buildingHeightCustomFloors != null && Number.isFinite(parseFloat(String(buildingHeightCustomFloors)))
              ? parseFloat(String(buildingHeightCustomFloors))
              : null,
          meterPhase: meterPhase ?? 'SINGLE',
          panelWattage: panelWattage ?? 'DEFAULT',
          panelWattageCustom:
            panelWattageCustom != null && Number.isFinite(parseFloat(String(panelWattageCustom)))
              ? parseFloat(String(panelWattageCustom))
              : null,
          structureCategory: structureCategory ?? 'STANDARD',
          structureOption: structureOption ?? '1ft',
        };
        const parsedWarrantyItems = parseWarrantyItemsFromBody(warrantyItems);
        const warrantyItemsStored = parsedWarrantyItems?.length
          ? serializeWarrantyItemsForStorage(parsedWarrantyItems)
          : undefined;
        const warrantyOverrides =
          warrantyItemsStored?.length || panelWarrantyYears
            ? {
                panelWarrantyYears: panelWarrantyYears ? parseInt(String(panelWarrantyYears), 10) : 25,
                ...(warrantyItemsStored?.length ? { warrantyItems: warrantyItemsStored } : {}),
              }
            : undefined;
        const parsedBomItems = parseBomItemsFromBody(bomItems);
        const bomItemsStored = parsedBomItems?.length
          ? serializeBomItemsForStorage(parsedBomItems)
          : undefined;
        const templateOverrides =
          (() => {
            const hasBom = Boolean(bomItemsStored?.length);
            const hasPayment =
              (Array.isArray(paymentMilestones) && paymentMilestones.length > 0) ||
              (Array.isArray(paymentModes) && paymentModes.length > 0) ||
              (Array.isArray(paymentTermsBullets) && paymentTermsBullets.length > 0);
            if (!hasBom && !hasPayment) return undefined;
            return {
              ...(bomItemsStored?.length ? { bomItems: bomItemsStored } : {}),
              ...(Array.isArray(paymentMilestones) && paymentMilestones.length > 0
                ? { paymentMilestones } : {}),
              ...(Array.isArray(paymentModes) && paymentModes.length > 0 ? { paymentModes } : {}),
              ...(Array.isArray(paymentTermsBullets) && paymentTermsBullets.length > 0
                ? { paymentTermsBullets } : {}),
            };
          })();
        await prisma.quotation.update({
          where: { id: quotation.id },
          data: {
            quotationDataJson: JSON.parse(JSON.stringify({
              inputs,
              costBreakdown: cb,
              quotationMode,
              combinedSingleCosting: quotationMode === 'COMBINED' ? Boolean(combinedSingleCostingBody) : undefined,
              combinedSystems: combinedSystemsCalc?.systems,
              combinedSummary: combinedSystemsCalc?.combined,
              costingOptions: costingOptionsCalc ?? undefined,
              formData: {
                pricePerWatt,
                electricityRatePerUnit: parseFloat(electricityRatePerUnit),
                systemSizeKw: sysKw,
                inverterSizeKw: (inverterSizeKw != null && parseFloat(inverterSizeKw) > 0)
                  ? parseFloat(inverterSizeKw) : sysKw,
                systemType: resolvedSystemType,
                siteType: resolvedSiteType,
                quotationMode,
                combinedSingleCosting: quotationMode === 'COMBINED' ? Boolean(combinedSingleCostingBody) : undefined,
                sanctionedLoadKw: sanctionedLoadKw ? parseFloat(sanctionedLoadKw) : null,
                sanctionedLoadIncreasedToKw:
                  sanctionedLoadIncreasedToKw !== undefined &&
                  sanctionedLoadIncreasedToKw !== null &&
                  String(sanctionedLoadIncreasedToKw).trim() !== '' &&
                  Number.isFinite(parseFloat(String(sanctionedLoadIncreasedToKw)))
                    ? parseFloat(String(sanctionedLoadIncreasedToKw))
                    : null,
                ...quickConfig,
              },
              systemConfig: buildQuickQuoteDisplayConfig(sysKw, quickConfig),
              warrantyOverrides,
              templateOverrides,
              proposalNote:
                proposalNote &&
                typeof proposalNote === 'object' &&
                typeof proposalNote.text === 'string' &&
                proposalNote.text.trim() &&
                typeof proposalNote.placement === 'string' &&
                proposalNote.placement.trim()
                  ? {
                      text: proposalNote.text.trim(),
                      placement: proposalNote.placement.trim(),
                    }
                  : undefined,
              siteCosting: siteCosting && typeof siteCosting === 'object' ? siteCosting : undefined,
              sitePhotos: Array.isArray(sitePhotos) ? sitePhotos : undefined,
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
    body('sanctionedLoadIncreasedToKw').optional().isFloat({ min: 0 }),
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
      if (req.body.sanctionedLoadIncreasedToKw !== undefined) {
        const v = req.body.sanctionedLoadIncreasedToKw;
        updateData.sanctionedLoadIncreasedToKw =
          v === null || v === '' ? null : parseFloat(String(v)) || null;
      }
      if (req.body.inverterSizeKw !== undefined) {
        updateData.inverterSizeKw = parseFloat(req.body.inverterSizeKw) || null;
      } else if (req.body.systemSizeKw !== undefined) {
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
          sanctionedLoadIncreasedToKw: req.body.sanctionedLoadIncreasedToKw,
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

/** Generate and return PDF directly (no frontend). POST /quotations/pdf with body { id } */
router.post('/pdf', authenticate, [
  body('id').trim().notEmpty().withMessage('id required'),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = req.body.id as string;

    const q = await prisma.quotation.findUnique({
      where: { id },
      select: { id: true, quoteNumber: true, result: true },
    });
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    if (!q.result) {
      return res.status(400).json({
        error: 'Quotation not yet calculated. Please run the calculation first.',
      });
    }

    const pdfBuffer = await generateQuotationPdfBuffer(id);
    const filename = q.quoteNumber ? `${q.quoteNumber}.pdf` : 'quotation.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

/** Download quotation PDF — serve stored file if available, else generate via HTML template (fallback: legacy DCR) */
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
        const filename = q.quoteNumber ? `${q.quoteNumber}.pdf` : 'quotation.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', String(buf.length));
        return res.end(buf);
      }
    }

    // Fallback: try HTML template (Puppeteer), then legacy DCR
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

    let pdfBytes: Buffer;
    try {
      pdfBytes = await generateQuotationPdfBuffer(qFull.id);
    } catch (puppeteerErr) {
      console.warn('[PDF] Puppeteer failed, using legacy DCR:', (puppeteerErr as Error).message);
      // ── Unpack stored breakdown (legacy DCR) ─────────────────────────────
      const breakdown  = (qFull.result!.breakdown as Record<string, unknown>) ?? {};
      const inputs     = (breakdown.inputs      as Record<string, number>) ?? {};
      const costBreak  = (breakdown.costBreakdown as Record<string, number>) ?? {};

      const systemKw     = inputs.systemSizeKw ?? (qFull.totalWattage ? qFull.totalWattage / 1000 : 0);
      const totalWatts   = systemKw * 1000;
      const panelWatt    = 575;
      const numPanels    = Math.ceil(totalWatts / panelWatt);
      const areaPerPanel = 15;

      const peakSun    = inputs.peakSunHours         ?? 4;
      const efficiency = inputs.systemEfficiency      ?? 0.8;
      const inflation  = inputs.gridInflationPct      ?? 3;
      const tariff     = inputs.electricityRatePerUnit ?? 18;

      const annualGenKwh = systemKw * peakSun * ROI_DAYS_PER_YEAR * efficiency;
      const annualSavYr1 = Math.round(annualGenKwh * tariff);
      const savings30yr  = calc30YrSavings(annualSavYr1, inflation);

      const netCost   = costBreak.netCost       ?? qFull.totalAmount ?? 0;
      const baseCost  = costBreak.baseCost      ?? 0;
      const gstAmount = costBreak.gstAmount     ?? 0;
      const grossCost = costBreak.grossCost     ?? 0;
      const subsidy   = costBreak.subsidyAmount ?? 0;

      const emiDataPdf = breakdown.emi as Record<string, { emi?: number }> | undefined;
      const loanRate = inputs.emiRatePct ?? 9;
      const a1 = emiDataPdf?.tenure3yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 36);
      const a2 = emiDataPdf?.tenure5yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 48);
      const a3 = emiDataPdf?.tenure7yr?.emi ?? calcLoanEmi(grossCost, 0.8, loanRate, 60);

      const fmtInr = (n: number) =>
        n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

      const now = new Date();
      const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

      const payback = qFull.result!.roiYears
        ? Math.round(qFull.result!.roiYears * 10) / 10
        : 0;

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
      y4: String(Math.round((annualGenKwh / ROI_DAYS_PER_YEAR) * 10) / 10),
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

      pdfBytes = Buffer.from(await generateFilledPdf(values));

      // Auto-save generated PDF for future direct download
      if (!qFull.generatedPdfPath) {
        try {
          await mkdir(UPLOADS_DIR, { recursive: true });
          const version = (qFull as { version?: number }).version ?? 1;
          const filename = `${qFull.quoteNumber}_v${version}.pdf`;
          await writeFile(join(UPLOADS_DIR, filename), pdfBytes);
          await prisma.quotation.update({
            where: { id: qFull.id },
            data: { generatedPdfPath: filename },
          });
        } catch { /* non-blocking */ }
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${qFull.quoteNumber}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(pdfBytes);
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

    const parentJson = (parent.quotationDataJson as Record<string, unknown> | null) ?? {};
    await prisma.quotation.update({
      where: { id: newQuotation.id },
      data: {
        quotationDataJson: {
          ...parentJson,
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
          formData: { ...(parentJson.formData as object | undefined), ...formData },
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

/** Update quotation status (Draft → Review → Sent → Accepted/Rejected) */
router.patch('/:id/status', authenticate, [
  body('status').isIn(['DRAFT', 'REVIEW', 'SENT', 'ACCEPTED', 'REJECTED']),
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

/** Lock or unlock quotation pricing */
router.patch('/:id/pricing-lock', authenticate, [
  body('locked').isBoolean(),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const q = await prisma.$executeRaw`
      UPDATE "quotations" SET "isPricingLocked" = ${Boolean(req.body.locked)}
      WHERE "id" = ${req.params.id}
    `;
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    const updated = await prisma.quotation.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) { next(err); }
});

/** Duplicate quotation (full snapshot, new quote number, DRAFT) */
router.post('/:id/duplicate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id!;
    const parent = await prisma.quotation.findUnique({
      where: { id },
      include: { result: true },
    });
    if (!parent) return res.status(404).json({ error: 'Quotation not found' });

    const quoteNum = await generateQTNumber();
    const userId = req.user!.userId;

    const dup = await prisma.quotation.create({
      data: {
        customerId: parent.customerId,
        siteId: parent.siteId,
        quoteNumber: quoteNum,
        version: 1,
        parentQuotationId: null,
        quotationType: parent.quotationType,
        systemType: parent.systemType,
        siteType: parent.siteType,
        sanctionedLoadKw: parent.sanctionedLoadKw,
        sanctionedLoadIncreasedToKw: parent.sanctionedLoadIncreasedToKw,
        inverterSizeKw: parent.inverterSizeKw,
        totalWattage: parent.totalWattage,
        totalAmount: parent.totalAmount,
        notes: parent.notes,
        status: 'DRAFT',
        quotationDataJson: parent.quotationDataJson ?? undefined,
        createdById: userId,
      },
    });

    if (parent.result) {
      const { calculateQuotation } = await import('../services/quotation.service.js');
      const json = (parent.quotationDataJson as Record<string, unknown> | null) ?? {};
      const inputs = (json.inputs as Record<string, unknown>) ?? {};
      await calculateQuotation(dup.id, {
        systemSizeKw: Number(inputs.systemSizeKw) || (parent.totalWattage ? parent.totalWattage / 1000 : 3),
        pricePerWatt: Number(inputs.pricePerWatt) || 55,
        profitMarginPct: Number(inputs.profitMarginPct) || 0,
        gstPct: Number(inputs.gstPct) || 8.9,
        electricityRatePerUnit: Number(inputs.electricityRatePerUnit) || 18,
        peakSunHours: Number(inputs.peakSunHours) || 4,
        systemType: parent.systemType,
        siteType: parent.siteType,
      }, userId);
    }

    res.status(201).json({ id: dup.id, quoteNumber: dup.quoteNumber });
  } catch (err) { next(err); }
});

/** Update site costing on saved quotation + optional price sync */
router.put('/:id/site-costing', authenticate, [
  body('siteCosting').isObject(),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = req.params.id!;
    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Quotation not found' });

    const lockedRows = await prisma.$queryRaw<Array<{ isPricingLocked: boolean }>>`
      SELECT COALESCE("isPricingLocked", false) AS "isPricingLocked" FROM "quotations" WHERE "id" = ${id}
    `;
    if (lockedRows[0]?.isPricingLocked) {
      return res.status(403).json({ error: 'Pricing is locked on this quotation' });
    }

    const json = (existing.quotationDataJson as Record<string, unknown> | null) ?? {};
    const siteCosting = req.body.siteCosting as Record<string, unknown>;
    const nextJson = { ...json, siteCosting };

    const ppw = siteCosting.pricePerWatt;
    if (ppw != null && Number.isFinite(Number(ppw)) && existing.result) {
      const inputs = (json.inputs as Record<string, unknown>) ?? {};
      const { calculateQuotation } = await import('../services/quotation.service.js');
      await calculateQuotation(id, {
        systemSizeKw: Number(inputs.systemSizeKw) || Number(siteCosting.systemSizeKw) || 3,
        pricePerWatt: Number(ppw),
        profitMarginPct: Number(inputs.profitMarginPct) || Number(siteCosting.profitMarginPct) || 0,
        gstPct: Number(inputs.gstPct) || 8.9,
        electricityRatePerUnit: Number(inputs.electricityRatePerUnit) || 18,
        peakSunHours: Number(inputs.peakSunHours) || 4,
        systemType: existing.systemType,
        siteType: existing.siteType,
      }, req.user!.userId);
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { quotationDataJson: nextJson as object },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

/** Upload site survey photo */
router.post(
  '/:id/site-photos',
  authenticate,
  photoUpload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id!;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'photo file required' });

      const q = await prisma.quotation.findUnique({ where: { id } });
      if (!q) return res.status(404).json({ error: 'Quotation not found' });

      const dir = join(UPLOADS_DIR, id);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filepath = join(dir, filename);
      await writeFile(filepath, file.buffer);

      const url = `/api/quotations/${id}/site-photos/${filename}`;
      const json = (q.quotationDataJson as Record<string, unknown> | null) ?? {};
      const photos = Array.isArray(json.sitePhotos) ? [...json.sitePhotos] : [];
      photos.push({ name: file.originalname, url, filename });

      await prisma.quotation.update({
        where: { id },
        data: { quotationDataJson: { ...json, sitePhotos: photos } as object },
      });

      res.json({ name: file.originalname, url });
    } catch (err) { next(err); }
  },
);

router.get('/:id/site-photos/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filepath = join(UPLOADS_DIR, req.params.id!, req.params.filename!);
    const buf = await readFile(filepath);
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(buf);
  } catch (err) { next(err); }
});

export default router;
