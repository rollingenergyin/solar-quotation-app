import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient, QuotationStatus } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// ─── Priority helpers ──────────────────────────────────────────────────────

type Priority = 'HOT' | 'FOLLOW_UP' | 'NEW' | 'COLD';

function calcPriority(createdAt: Date, quotations: { createdAt: Date }[]): Priority {
  const now = Date.now();
  const ageDays = (now - createdAt.getTime()) / 86_400_000;
  const latest = quotations[0];

  if (!latest) {
    if (ageDays <= 2) return 'NEW';
    if (ageDays >= 30) return 'COLD';
    return 'FOLLOW_UP';
  }
  const daysSince = (now - latest.createdAt.getTime()) / 86_400_000;
  if (daysSince >= 3 && daysSince <= 7) return 'HOT';
  if (daysSince > 14) return 'FOLLOW_UP';
  if (ageDays <= 2) return 'NEW';
  return 'FOLLOW_UP';
}

const PRIORITY_ORDER: Record<Priority, number> = {
  HOT: 0,
  FOLLOW_UP: 1,
  NEW: 2,
  COLD: 3,
};

// ─── GET /api/dashboard/sales ──────────────────────────────────────────────

router.get('/sales', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        quotations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            quoteNumber: true,
            createdAt: true,
            status: true,
            sanctionedLoadKw: true,
            totalAmount: true,
          },
        },
        sites: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { name: true, address: true, city: true },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const suggestions: { type: string; message: string; count: number }[] = [];

    const noFollowUp = customers.filter((c) => {
      const q = c.quotations[0];
      if (!q) return false;
      const days = (now - q.createdAt.getTime()) / 86_400_000;
      return days >= 7 && days <= 30;
    });
    if (noFollowUp.length > 0) {
      suggestions.push({
        type: 'followup',
        message: `${noFollowUp.length} customer${noFollowUp.length > 1 ? 's' : ''} quoted 7+ days ago — no follow-up`,
        count: noFollowUp.length,
      });
    }

    const newNoQuote = customers.filter((c) => {
      const days = (now - c.createdAt.getTime()) / 86_400_000;
      return days <= 7 && c.quotations.length === 0;
    });
    if (newNoQuote.length > 0) {
      suggestions.push({
        type: 'new_lead',
        message: `${newNoQuote.length} new lead${newNoQuote.length > 1 ? 's' : ''} added this week with no quotation`,
        count: newNoQuote.length,
      });
    }

    const coldLeads = customers.filter((c) => {
      const days = (now - c.createdAt.getTime()) / 86_400_000;
      return days >= 30 && c.quotations.length === 0;
    });
    if (coldLeads.length > 0) {
      suggestions.push({
        type: 'cold',
        message: `${coldLeads.length} cold lead${coldLeads.length > 1 ? 's' : ''} with no quotation in 30+ days`,
        count: coldLeads.length,
      });
    }

    const leads = customers
      .map((c) => {
        const latestQ = c.quotations[0];
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city,
          address: c.sites[0]?.address ?? c.address,
          siteCity: c.sites[0]?.city ?? c.city,
          createdAt: c.createdAt,
          createdBy: c.createdBy?.name ?? null,
          priority: calcPriority(c.createdAt, c.quotations),
          quotationCount: c.quotations.length,
          lastQuotedAt: latestQ?.createdAt ?? null,
          daysSinceLastQuote: latestQ
            ? Math.floor((now - latestQ.createdAt.getTime()) / 86_400_000)
            : null,
          quotations: c.quotations.map((q) => ({
            id: q.id,
            qtNumber: q.quoteNumber,
            createdAt: q.createdAt,
            status: q.status,
            systemSizeKw: q.sanctionedLoadKw,
            totalPrice: q.totalAmount,
          })),
        };
      })
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    res.json({ leads, suggestions });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/dashboard/director ─────────────────────────────────────────

router.get('/director', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

    const [quotationsThisMonth, quotationsLastMonth, allQuotations, totalCustomers, salesUsers] =
      await Promise.all([
        prisma.quotation.count({ where: { createdAt: { gte: startOfMonth } } }),
        prisma.quotation.count({
          where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        }),
        prisma.quotation.findMany({
          select: {
            id: true,
            status: true,
            createdAt: true,
            totalAmount: true,
            sanctionedLoadKw: true,
            createdById: true,
          },
        }),
        prisma.customer.count(),
        prisma.user.findMany({
          where: { role: 'SALES' },
          select: { id: true, name: true },
        }),
      ]);

    // Revenue from invoices this month (optional table)
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;
    try {
      const [rThis, rLast] = await Promise.all([
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COALESCE(SUM("totalAmount"),0)::float AS total
          FROM "invoices"
          WHERE "createdAt" >= ${startOfMonth}
        `,
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COALESCE(SUM("totalAmount"),0)::float AS total
          FROM "invoices"
          WHERE "createdAt" >= ${startOfLastMonth} AND "createdAt" <= ${endOfLastMonth}
        `,
      ]);
      revenueThisMonth = rThis[0]?.total ?? 0;
      revenueLastMonth = rLast[0]?.total ?? 0;
    } catch {
      // invoice table may not exist yet
    }

    const wonQuotations = allQuotations.filter((q) => q.status === QuotationStatus.ACCEPTED);
    const lostQuotations = allQuotations.filter((q) => q.status === QuotationStatus.REJECTED);
    const activeQuotations = allQuotations.filter(
      (q) => q.status === QuotationStatus.DRAFT || q.status === QuotationStatus.SENT
    );

    const funnel = [
      { stage: 'Total Leads', count: totalCustomers },
      { stage: 'Quoted', count: allQuotations.length },
      { stage: 'Active', count: activeQuotations.length },
      { stage: 'Accepted', count: wonQuotations.length },
      { stage: 'Rejected', count: lostQuotations.length },
    ];

    const conversionRate =
      allQuotations.length > 0
        ? Math.round((wonQuotations.length / allQuotations.length) * 100)
        : 0;

    const repStats = salesUsers.map((u) => {
      const repQuotes = allQuotations.filter((q) => q.createdById === u.id);
      const repWon = repQuotes.filter((q) => q.status === QuotationStatus.ACCEPTED);
      const repRevenue = repWon.reduce((sum, q) => sum + (q.totalAmount ?? 0), 0);
      return {
        id: u.id,
        name: u.name,
        totalQuotations: repQuotes.length,
        wonQuotations: repWon.length,
        conversionRate:
          repQuotes.length > 0 ? Math.round((repWon.length / repQuotes.length) * 100) : 0,
        revenue: repRevenue,
      };
    });

    // Weekly trend — last 8 weeks
    const weeklyTrend: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const count = allQuotations.filter(
        (q) => q.createdAt >= weekStart && q.createdAt <= weekEnd
      ).length;
      weeklyTrend.push({
        week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        count,
      });
    }

    // Stale leads — customers with no quotation in 14+ days
    const staleCustomers = await prisma.customer.findMany({
      where: { createdAt: { lt: fourteenDaysAgo } },
      select: { id: true },
    });
    const quotedCustomerIds = new Set(
      await prisma.quotation.findMany({ select: { customerId: true } }).then((qs) =>
        qs.map((q) => q.customerId)
      )
    );
    const staleLeadsCount = staleCustomers.filter((c) => !quotedCustomerIds.has(c.id)).length;

    const momDelta =
      quotationsLastMonth > 0
        ? Math.round(((quotationsThisMonth - quotationsLastMonth) / quotationsLastMonth) * 100)
        : 0;

    res.json({
      kpis: {
        revenueThisMonth,
        revenueLastMonth,
        quotationsThisMonth,
        quotationsLastMonth,
        momDelta,
        conversionRate,
        activeLeads: activeQuotations.length,
        totalCustomers,
      },
      funnel,
      repStats,
      weeklyTrend,
      staleLeadsCount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/dashboard/alerts ────────────────────────────────────────────

router.get('/alerts', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const alerts: {
      type: string;
      severity: 'high' | 'medium' | 'low';
      message: string;
      count?: number;
      link?: string;
    }[] = [];

    // 1. Absent staff today
    try {
      const todayDays = await prisma.attendanceDay.findMany({
        where: { date: todayStr },
        include: { checkIn: { select: { id: true } } },
      });
      const absentCount = todayDays.filter((d) => !d.checkIn).length;
      if (absentCount > 0) {
        alerts.push({
          type: 'absent_staff',
          severity: 'medium',
          message: `${absentCount} team member${absentCount > 1 ? 's' : ''} not checked in today`,
          count: absentCount,
          link: '/admin/attendance',
        });
      }
    } catch {
      // attendance tables may not exist
    }

    // 2. Stale leads
    const staleCustomers = await prisma.customer.findMany({
      where: { createdAt: { lt: fourteenDaysAgo } },
      include: { quotations: { select: { id: true }, take: 1 } },
    });
    const staleCount = staleCustomers.filter((c) => c.quotations.length === 0).length;
    if (staleCount > 0) {
      alerts.push({
        type: 'stale_leads',
        severity: staleCount > 5 ? 'high' : 'medium',
        message: `${staleCount} lead${staleCount > 1 ? 's' : ''} with no quotation in 14+ days`,
        count: staleCount,
        link: '/sales/customers',
      });
    }

    // 3. Pending leave requests
    try {
      const pendingLeaves = await prisma.leaveRequest.count({ where: { status: 'PENDING' } });
      if (pendingLeaves > 0) {
        alerts.push({
          type: 'pending_leaves',
          severity: 'low',
          message: `${pendingLeaves} pending leave request${pendingLeaves > 1 ? 's' : ''} awaiting approval`,
          count: pendingLeaves,
          link: '/admin/attendance/leaves',
        });
      }
    } catch {
      // leave table may not exist
    }

    // 4. Quotations open for 30+ days with no decision
    const openOldQuotations = await prisma.quotation.count({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] },
      },
    });
    if (openOldQuotations > 0) {
      alerts.push({
        type: 'open_quotations',
        severity: 'medium',
        message: `${openOldQuotations} quotation${openOldQuotations > 1 ? 's' : ''} open for 30+ days with no decision`,
        count: openOldQuotations,
        link: '/admin/quotations',
      });
    }

    // Sort by severity
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);

    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

export default router;
