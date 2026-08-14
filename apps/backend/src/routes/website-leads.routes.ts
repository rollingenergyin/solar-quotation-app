import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma, PrismaClient, Role, WebsiteLeadStatus } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { publicLeadGuard } from '../middleware/publicLeadGuard.js';

const router = Router();
const prisma = new PrismaClient();

const STATUSES: WebsiteLeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT',
  'QUOTATION',
  'NEGOTIATION',
  'WON',
  'LOST',
];

const REQUIREMENT_TYPES = [
  'SOLAR',
  'BESS',
  'SOLAR_PLUS_BESS',
  'CONSULTATION',
  'SITE_SURVEY',
  'ENERGY_ASSESSMENT',
] as const;

function isAdmin(req: Request) {
  return req.user?.role === Role.ADMIN;
}

function isSalesOrAdmin(req: Request) {
  return req.user?.role === Role.ADMIN || req.user?.role === Role.SALES;
}

function leadScope(req: Request): Prisma.WebsiteLeadWhereInput {
  if (isAdmin(req)) return {};
  return { assignedToId: req.user!.userId };
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown, max = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '').slice(0, 20);
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function requirementFromSource(sourceType?: string, bodyType?: string): string {
  const explicit = str(bodyType, 40)?.toUpperCase().replace(/[\s-]+/g, '_');
  if (explicit && (REQUIREMENT_TYPES as readonly string[]).includes(explicit)) return explicit;
  const source = (sourceType || '').toLowerCase();
  if (source.includes('bess')) return 'BESS';
  if (source.includes('solar')) return 'SOLAR';
  if (source.includes('survey')) return 'SITE_SURVEY';
  if (source.includes('assessment')) return 'ENERGY_ASSESSMENT';
  return 'CONSULTATION';
}

const leadInclude = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  quotation: { select: { id: true, quoteNumber: true, status: true } },
} as const;

export async function createPublicWebsiteLead(req: Request, res: Response, next: NextFunction) {
  try {
    const honeypot = str(req.body?.website) || str(req.body?.companyWebsite);
    if (honeypot) {
      return res.status(201).json({ ok: true });
    }

    const name = str(req.body?.name, 120);
    const companyName = str(req.body?.companyName) || str(req.body?.company, 160);
    const email = str(req.body?.email, 160)?.toLowerCase();
    const phoneRaw = str(req.body?.phone, 30);
    if (!name || !companyName || !email || !phoneRaw) {
      return res.status(400).json({ error: 'Name, company, email, and phone are required' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'A valid work email is required' });
    }
    const phone = normalizePhone(phoneRaw);
    if (!isPhone(phone)) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }

    const sourceType = str(req.body?.sourceType) || str(req.body?.source, 60) || 'contact';
    if (sourceType.toLowerCase() === 'careers') {
      return res.status(201).json({ ok: true });
    }

    const solarResults = sanitizeJson(req.body?.solarCalculatorResults);
    const bessResults = sanitizeJson(req.body?.bessCalculatorResults);
    const solarCapacity =
      parseOptionalNumber(req.body?.solarCapacity) ??
      parseOptionalNumber((req.body?.solarCalculatorResults as { systemSizeKw?: unknown } | undefined)?.systemSizeKw);
    const bessCapacity =
      parseOptionalNumber(req.body?.bessCapacity) ??
      parseOptionalNumber((req.body?.bessCalculatorResults as { energyKwh?: unknown } | undefined)?.energyKwh);

    const lead = await prisma.websiteLead.create({
      data: {
        name,
        companyName,
        email,
        phone,
        industry: str(req.body?.industry, 80),
        location: str(req.body?.location, 200),
        message: str(req.body?.message, 4000),
        requirementType: requirementFromSource(sourceType, req.body?.requirementType),
        solarCapacity,
        bessCapacity,
        monthlyElectricityBill: parseOptionalNumber(req.body?.monthlyElectricityBill ?? req.body?.monthlyBill),
        monthlyUnits: parseOptionalNumber(req.body?.monthlyUnits),
        connectedLoad: parseOptionalNumber(req.body?.connectedLoad ?? req.body?.connectedLoadKw),
        maximumDemand: parseOptionalNumber(req.body?.maximumDemand ?? req.body?.maxDemandKva),
        contractDemand: parseOptionalNumber(req.body?.contractDemand ?? req.body?.contractDemandKva),
        backupRequirement: str(req.body?.backupRequirement, 200),
        operatingHours: parseOptionalNumber(req.body?.operatingHours ?? req.body?.dailyOperatingHours),
        solarCalculatorResults: solarResults,
        bessCalculatorResults: bessResults,
        sourcePage: str(req.body?.sourcePage, 300),
        sourceType,
        utmSource: str(req.body?.utmSource, 120),
        utmMedium: str(req.body?.utmMedium, 120),
        utmCampaign: str(req.body?.utmCampaign, 160),
        utmTerm: str(req.body?.utmTerm, 160),
        utmContent: str(req.body?.utmContent, 160),
        landingPage: str(req.body?.landingPage, 300),
        referrer: str(req.body?.referrer, 400),
      },
    });

    res.status(201).json({ ok: true, id: lead.id });
  } catch (err) {
    next(err);
  }
}

router.post('/public', publicLeadGuard, createPublicWebsiteLead);

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSalesOrAdmin(req)) return res.status(403).json({ error: 'Insufficient permissions' });

    const {
      status,
      industry,
      requirementType,
      assignedTo,
      sourceType,
      company,
      search,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query;

    const take = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const where: Prisma.WebsiteLeadWhereInput = { ...leadScope(req) };
    if (status && STATUSES.includes(String(status) as WebsiteLeadStatus)) {
      where.status = String(status) as WebsiteLeadStatus;
    }
    if (industry) where.industry = { equals: String(industry), mode: 'insensitive' };
    if (requirementType) where.requirementType = String(requirementType);
    if (sourceType) where.sourceType = String(sourceType);
    if (company) where.companyName = { contains: String(company), mode: 'insensitive' };
    if (isAdmin(req) && assignedTo) where.assignedToId = String(assignedTo);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(String(from));
      if (to) {
        const end = new Date(String(to));
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (search) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.websiteLead.findMany({
        where,
        include: leadInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.websiteLead.count({ where }),
    ]);

    res.json({ leads, total, page: Math.max(1, Number(page) || 1), pages: Math.ceil(total / take) });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSalesOrAdmin(req)) return res.status(403).json({ error: 'Insufficient permissions' });
    const scope = leadScope(req);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [total, newCount, today, thisWeek, siteVisit, quotation, won, lost] = await Promise.all([
      prisma.websiteLead.count({ where: scope }),
      prisma.websiteLead.count({ where: { ...scope, status: 'NEW' } }),
      prisma.websiteLead.count({ where: { ...scope, createdAt: { gte: startOfToday } } }),
      prisma.websiteLead.count({ where: { ...scope, createdAt: { gte: startOfWeek } } }),
      prisma.websiteLead.count({ where: { ...scope, status: 'SITE_VISIT' } }),
      prisma.websiteLead.count({ where: { ...scope, status: 'QUOTATION' } }),
      prisma.websiteLead.count({ where: { ...scope, status: 'WON' } }),
      prisma.websiteLead.count({ where: { ...scope, status: 'LOST' } }),
    ]);

    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

    res.json({
      total,
      new: newCount,
      today,
      thisWeek,
      siteVisit,
      quotation,
      won,
      lost,
      conversionRate,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/assignees', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Insufficient permissions' });
    const users = await prisma.user.findMany({
      where: { role: { in: [Role.SALES, Role.ADMIN] }, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true, userId: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSalesOrAdmin(req)) return res.status(403).json({ error: 'Insufficient permissions' });
    const lead = await prisma.websiteLead.findFirst({
      where: { id: req.params.id, ...leadScope(req) },
      include: leadInclude,
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isSalesOrAdmin(req)) return res.status(403).json({ error: 'Insufficient permissions' });
    const existing = await prisma.websiteLead.findFirst({
      where: { id: req.params.id, ...leadScope(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const data: Prisma.WebsiteLeadUpdateInput = {};
    if (req.body.notes !== undefined) data.notes = str(req.body.notes, 8000) ?? null;
    if (req.body.lastContactedAt !== undefined) {
      data.lastContactedAt = req.body.lastContactedAt ? new Date(req.body.lastContactedAt) : null;
    }
    if (req.body.nextFollowUp !== undefined) {
      data.nextFollowUp = req.body.nextFollowUp ? new Date(req.body.nextFollowUp) : null;
    }
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      data.status = req.body.status;
      if (req.body.status === 'CONTACTED' && !existing.lastContactedAt && req.body.lastContactedAt === undefined) {
        data.lastContactedAt = new Date();
      }
    }
    if (req.body.assignedToId !== undefined) {
      if (!isAdmin(req)) return res.status(403).json({ error: 'Only admin can assign leads' });
      if (req.body.assignedToId === null || req.body.assignedToId === '') {
        data.assignedTo = { disconnect: true };
      } else {
        const user = await prisma.user.findFirst({
          where: { id: String(req.body.assignedToId), role: { in: [Role.SALES, Role.ADMIN] } },
        });
        if (!user) return res.status(400).json({ error: 'Invalid salesperson' });
        data.assignedTo = { connect: { id: user.id } };
      }
    }
    if (req.body.quotationId !== undefined) {
      const quotationId = str(req.body.quotationId, 60);
      if (!quotationId) {
        data.quotation = { disconnect: true };
      } else {
        const quotation = await prisma.quotation.findUnique({ where: { id: quotationId }, select: { id: true } });
        if (!quotation) return res.status(400).json({ error: 'Quotation not found' });
        data.quotation = { connect: { id: quotation.id } };
        if (!req.body.status) data.status = 'QUOTATION';
      }
    }

    const lead = await prisma.websiteLead.update({
      where: { id: existing.id },
      data,
      include: leadInclude,
    });
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

export default router;
