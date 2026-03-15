import { Router, type Request, type Response, type NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';

const requireAdmin = requireRoles('ADMIN');

const router = Router();
const prisma = new PrismaClient();

// ── GET active template (any authenticated user — used by print page) ──────
// Optional query: ?systemType=DCR&siteType=RESIDENTIAL to get matching template
router.get('/active', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const systemType = req.query.systemType as string | undefined;
    const siteType = req.query.siteType as string | undefined;

    if (systemType && siteType) {
      const { selectTemplateForQuotation } = await import('../services/template-selection.service.js');
      const template = await selectTemplateForQuotation(
        systemType as 'DCR' | 'NON_DCR',
        siteType as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL'
      );
      if (!template) return res.status(404).json({ error: 'No active template found' });
      return res.json(template);
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM quotation_templates
      WHERE "isActive" = true AND "isDeleted" = false
      ORDER BY "updatedAt" DESC LIMIT 1
    `;
    const template = rows[0]
      ? await prisma.quotationTemplate.findUnique({ where: { id: rows[0].id } })
      : null;
    if (!template) return res.status(404).json({ error: 'No active template found' });
    res.json(template);
  } catch (err) { next(err); }
});

// ── GET all templates (admin) ──────────────────────────────────────────────
// ?includeDeleted=1 to also return soft-deleted templates (for Restore UX)
// Uses raw SQL to avoid Prisma client schema sync issues with isDeleted
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const includeDeleted = req.query.includeDeleted === '1';
    const rows = includeDeleted
      ? await prisma.$queryRaw`
          SELECT t.id, t.version, t.name, t."isActive", t."systemType", t."siteType",
                 t."companyName", t."createdAt", t."updatedAt", t."isDefaultTemplate", t."isDeleted",
                 u.name AS "createdByName"
          FROM quotation_templates t
          LEFT JOIN users u ON t."createdById" = u.id
          ORDER BY t."createdAt" DESC
        `
      : await prisma.$queryRaw`
          SELECT t.id, t.version, t.name, t."isActive", t."systemType", t."siteType",
                 t."companyName", t."createdAt", t."updatedAt", t."isDefaultTemplate", t."isDeleted",
                 u.name AS "createdByName"
          FROM quotation_templates t
          LEFT JOIN users u ON t."createdById" = u.id
          WHERE t."isDeleted" = false
          ORDER BY t."createdAt" DESC
        `;
    const templates = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      version: r.version,
      name: r.name,
      isActive: r.isActive,
      systemType: r.systemType,
      siteType: r.siteType,
      companyName: r.companyName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isDefaultTemplate: r.isDefaultTemplate,
      isDeleted: r.isDeleted,
      createdBy: r.createdByName ? { name: r.createdByName } : null,
    }));
    res.json(templates);
  } catch (err) { next(err); }
});

// ── GET single template (admin) ────────────────────────────────────────────
router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id: req.params.id },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.isDeleted) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) { next(err); }
});

// ── POST create new template (admin) ──────────────────────────────────────
router.post('/', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('name required'),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Auto-increment version from existing templates
    const maxVersion = await prisma.quotationTemplate.aggregate({ _max: { version: true } });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const {
      name, systemType, siteType,
      companyName, companyTagline, companyAddress, companyPhone, companyEmail, companyWebsite,
      introLetterBody, aboutParagraphs, aboutMission, aboutStats, aboutHighlights,
      processSteps, processTimelineText, maintenanceServices, warrantyItems,
      paymentMilestones, paymentTermsBullets, paymentModes,
      whyReasons, testimonials, certifications,
      depreciationTable, depreciationNote, bomItems, bomShowQty, bomShowUnit,
      panelWarrantyYears, subsidyResidential1kw, subsidyResidential2kw, subsidyResidential3to10kw, subsidySocietyPerKw,
    } = req.body;

    const defaultDepreciationTable = [
      { year: 'Year 1', rate: '40%', note: 'WDV accelerated depreciation' },
      { year: 'Year 2', rate: '24%', note: '40% on remaining 60%' },
      { year: 'Year 3', rate: '14.4%', note: '40% on remaining 36%' },
      { year: 'Year 4+', rate: '8.6%', note: 'Diminishing balance' },
    ];

    const template = await prisma.quotationTemplate.create({
      data: {
        version: nextVersion,
        name,
        isActive: false,
        systemType: systemType ?? 'ANY',
        siteType: siteType ?? 'ANY',
        companyName: companyName ?? 'Rolling Energy',
        companyTagline, companyAddress, companyPhone, companyEmail, companyWebsite,
        panelWarrantyYears: panelWarrantyYears ?? 25,
        bomShowQty: bomShowQty ?? false,
        bomShowUnit: bomShowUnit ?? false,
        bomItems: bomItems ?? null,
        subsidyResidential1kw: subsidyResidential1kw ?? 30000,
        subsidyResidential2kw: subsidyResidential2kw ?? 60000,
        subsidyResidential3to10kw: subsidyResidential3to10kw ?? 78000,
        subsidySocietyPerKw: subsidySocietyPerKw ?? 18000,
        depreciationNote: depreciationNote ?? 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules.',
        depreciationTable: depreciationTable ?? defaultDepreciationTable,
        introLetterBody: introLetterBody ?? [],
        aboutParagraphs: aboutParagraphs ?? [],
        aboutMission: aboutMission ?? '',
        aboutStats: aboutStats ?? [],
        aboutHighlights: aboutHighlights ?? [],
        processSteps: processSteps ?? [],
        processTimelineText: processTimelineText ?? 'Total Timeline: 10–18 Working Days',
        maintenanceServices: maintenanceServices ?? [],
        warrantyItems: warrantyItems ?? [],
        paymentMilestones: paymentMilestones ?? [],
        paymentTermsBullets: paymentTermsBullets ?? [],
        paymentModes: paymentModes ?? [],
        whyReasons: whyReasons ?? [],
        testimonials: testimonials ?? [],
        certifications: certifications ?? [],
        createdById: req.user!.userId,
      },
    });

    res.status(201).json(template);
  } catch (err) { next(err); }
});

// ── PUT update template (admin) ────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (existing.isDeleted) return res.status(404).json({ error: 'Template not found' });

    const allowedFields = [
      'name', 'systemType', 'siteType',
      'companyName', 'companyTagline', 'companyAddress', 'companyPhone',
      'companyEmail', 'companyWebsite',
      'panelWarrantyYears',
      'bomShowQty', 'bomShowUnit', 'bomItems',
      'subsidyResidential1kw', 'subsidyResidential2kw', 'subsidyResidential3to10kw', 'subsidySocietyPerKw',
      'depreciationNote', 'depreciationTable',
      'introLetterBody', 'aboutParagraphs', 'aboutMission', 'aboutStats', 'aboutHighlights',
      'processSteps', 'processTimelineText', 'maintenanceServices', 'warrantyItems',
      'paymentMilestones', 'paymentTermsBullets', 'paymentModes',
      'whyReasons', 'testimonials', 'certifications',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const updated = await prisma.quotationTemplate.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// ── POST activate a template (admin) ──────────────────────────────────────
// Multiple templates can be active; selection uses systemType+siteType matching
router.post('/:id/activate', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.isDeleted) return res.status(404).json({ error: 'Template not found' });

    const activated = await prisma.quotationTemplate.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    res.json(activated);
  } catch (err) { next(err); }
});

// ── DELETE a template (admin) — soft delete ─────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.isDeleted) return res.status(404).json({ error: 'Template not found' });

    await prisma.quotationTemplate.update({
      where: { id: req.params.id },
      data: { isDeleted: true, isActive: false },
    });

    res.status(204).send();
  } catch (err) { next(err); }
});

// ── POST restore a soft-deleted template (admin) ────────────────────────────
router.post('/:id/restore', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!template.isDeleted) return res.status(400).json({ error: 'Template is not deleted' });

    const restored = await prisma.quotationTemplate.update({
      where: { id: req.params.id },
      data: { isDeleted: false },
    });

    res.json(restored);
  } catch (err) { next(err); }
});

// ── POST deactivate a template (admin) ────────────────────────────────────
router.post('/:id/deactivate', authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.isDeleted) return res.status(404).json({ error: 'Template not found' });

    const deactivated = await prisma.quotationTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json(deactivated);
  } catch (err) { next(err); }
});

// ── POST clone an existing template as new version (admin) ────────────────
router.post('/:id/clone', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('name required'),
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await prisma.quotationTemplate.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Template not found' });
    if (source.isDeleted) return res.status(404).json({ error: 'Template not found' });

    const maxVer = await prisma.$queryRaw<Array<{ max: number | null }>>`
      SELECT MAX(version) as max FROM quotation_templates WHERE "isDeleted" = false
    `;
    const maxVersion = { _max: { version: maxVer[0]?.max ?? null } };
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    const { id: _id, createdAt: _c, updatedAt: _u, createdById: _cb, isActive: _a, version: _v, isDeleted: _d, isDefaultTemplate: _dt, ...rest } = source;

    const cloned = await prisma.quotationTemplate.create({
      data: {
        ...rest,
        name: req.body.name,
        version: nextVersion,
        isActive: false,
        isDefaultTemplate: false,
        systemType: source.systemType ?? 'ANY',
        siteType: source.siteType ?? 'ANY',
        createdById: req.user!.userId,
      } as import('@prisma/client').Prisma.QuotationTemplateCreateInput,
    });

    res.status(201).json(cloned);
  } catch (err) { next(err); }
});

export default router;
