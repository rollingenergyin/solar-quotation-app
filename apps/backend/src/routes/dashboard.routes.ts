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

// ─── Sales Panel (CRM — action-driven, AI-scored) ─────────────────────────

const STAGE_PRIORITY_SCORES: Record<string, number> = {
  NEGOTIATION: 40, PROPOSAL_SENT: 35, SITE_VISIT_DONE: 30, SITE_VISIT_SCHEDULED: 28,
  QUALIFIED: 22, CONTACTED: 15, NEW: 10,
  CLOSED_WON: 0, CLOSED_LOST: 0, DISQUALIFIED: 0,
};

const CONVERSION_PROB: Record<string, number> = {
  NEGOTIATION: 75, PROPOSAL_SENT: 40, SITE_VISIT_DONE: 35, SITE_VISIT_SCHEDULED: 25,
  QUALIFIED: 20, CONTACTED: 10, NEW: 5,
};

const SP_MSG_TEMPLATES: Record<string, Record<string, string>> = {
  NEW_INTRO: {
    EN: "Hi {name}! I'm from Rolling Energy Solar. I wanted to connect about solar energy for your home — we help families cut electricity bills by 80%+. When's a good time to chat?",
    HI: "नमस्ते {name}! मैं Rolling Energy Solar से हूँ। आपके घर के लिए सोलर के बारे में बात करना चाहता था — हम बिजली बिल में 80% तक की बचत करते हैं। कब बात कर सकते हैं?",
    MR: "नमस्कार {name}! मी Rolling Energy Solar मधून बोलतोय. घरासाठी सोलरबद्दल बोलायचे होते — वीज बिलात 80% बचत होते. कधी बोलता येईल?",
  },
  FOLLOW_UP: {
    EN: "Hi {name}, just following up on our solar conversation. Any questions I can help with? Happy to share more details!",
    HI: "नमस्ते {name}, सोलर के बारे में हुई बातचीत पर फॉलो-अप कर रहा था। कोई सवाल हो तो बताएं!",
    MR: "नमस्कार {name}, सोलरबद्दल बोललो होतो त्यावर फॉलो-अप करतोय. काही प्रश्न असतील तर नक्की सांगा!",
  },
  PROPOSAL_REMINDER: {
    EN: "Hi {name}, I sent you the solar quotation a few days back. Did you get a chance to review it? Happy to answer any questions!",
    HI: "नमस्ते {name}, कुछ दिन पहले सोलर कोटेशन भेजा था। क्या आपने देखा? कोई भी सवाल पूछ सकते हैं!",
    MR: "नमस्कार {name}, काही दिवसांपूर्वी सोलर कोटेशन पाठवले होते. पाहिले का? काही प्रश्न असतील तर नक्की सांगा!",
  },
  SITE_VISIT: {
    EN: "Hi {name}, our solar engineer is ready to visit your {city} property for a free feasibility check. Can we schedule this week?",
    HI: "नमस्ते {name}, हमारे सोलर इंजीनियर {city} में आपकी संपत्ति का मुफ्त आकलन करने के लिए तैयार हैं। क्या इस हफ्ते शेड्यूल कर सकते हैं?",
    MR: "नमस्कार {name}, आमचे सोलर इंजिनियर {city} मधील तुमच्या मालमत्तेचे मोफत मूल्यांकन करायला तयार आहेत. या आठवड्यात ठरवता येईल का?",
  },
  CLOSE_DEAL: {
    EN: "Hi {name}, we're very close to finalizing your {kw}kW solar system. I want to make sure you get the best deal before prices change. Can we finalize today?",
    HI: "नमस्ते {name}, आपका {kw}kW सोलर सिस्टम फाइनलाइज़ होने के बहुत करीब है। कीमतें बदलने से पहले सबसे अच्छा सौदा दिलाना चाहता हूँ। आज फाइनलाइज़ करें?",
    MR: "नमस्कार {name}, तुमचं {kw}kW सोलर सिस्टम फायनलाइझ होण्याच्या जवळ आहोत. किंमती बदलण्यापूर्वी सर्वोत्तम डील मिळवून द्यायची आहे. आज फायनलाइझ करता येईल का?",
  },
};

type SpActionType = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'STAGE_UPDATE';
type SpUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

function spCalcNextAction(stage: string, hoursInactive: number, signal: string): {
  type: SpActionType; urgency: SpUrgency; reason: string; messageKey: string | null; cta: string;
} {
  if (stage === 'NEW') {
    if (hoursInactive < 4) return { type: 'CALL', urgency: 'CRITICAL', reason: 'New lead — call within the 4-hour golden window', messageKey: 'NEW_INTRO', cta: 'Call Now' };
    if (hoursInactive < 24) return { type: 'WHATSAPP', urgency: 'HIGH', reason: 'New lead — send intro before they forget', messageKey: 'NEW_INTRO', cta: 'Send Intro' };
    return { type: 'WHATSAPP', urgency: 'HIGH', reason: 'Re-engage new lead with intro message', messageKey: 'NEW_INTRO', cta: 'Send Intro' };
  }
  if (stage === 'CONTACTED') {
    if (signal === 'REPLIED') return { type: 'CALL', urgency: 'CRITICAL', reason: 'Lead replied — call now while interest is hot', messageKey: null, cta: 'Call Now' };
    if (hoursInactive > 72) return { type: 'WHATSAPP', urgency: 'HIGH', reason: `No response for ${Math.round(hoursInactive / 24)}d — send follow-up`, messageKey: 'FOLLOW_UP', cta: 'Send Follow-up' };
    return { type: 'CALL', urgency: 'MEDIUM', reason: 'Qualify lead with a quick call', messageKey: 'FOLLOW_UP', cta: 'Call to Qualify' };
  }
  if (stage === 'QUALIFIED') {
    if (hoursInactive > 48) return { type: 'CALL', urgency: 'HIGH', reason: 'Qualified lead waiting — schedule site visit', messageKey: 'SITE_VISIT', cta: 'Schedule Visit' };
    return { type: 'WHATSAPP', urgency: 'MEDIUM', reason: 'Confirm site visit details', messageKey: 'SITE_VISIT', cta: 'Confirm Visit' };
  }
  if (stage === 'SITE_VISIT_SCHEDULED') {
    return { type: 'CALL', urgency: 'HIGH', reason: 'Confirm site visit appointment', messageKey: 'SITE_VISIT', cta: 'Confirm Appointment' };
  }
  if (stage === 'SITE_VISIT_DONE') {
    return { type: 'WHATSAPP', urgency: 'HIGH', reason: 'Site visit done — send proposal immediately', messageKey: 'FOLLOW_UP', cta: 'Send Proposal' };
  }
  if (stage === 'PROPOSAL_SENT') {
    if (signal === 'REPLIED') return { type: 'CALL', urgency: 'CRITICAL', reason: 'Lead responded to proposal — call to convert', messageKey: null, cta: 'Call to Close' };
    if (hoursInactive > 168) return { type: 'WHATSAPP', urgency: 'HIGH', reason: '7+ days no response — send multilingual reminder', messageKey: 'PROPOSAL_REMINDER', cta: 'Send Reminder' };
    if (hoursInactive > 72) return { type: 'CALL', urgency: 'HIGH', reason: 'Follow up on proposal — 3+ days without reply', messageKey: null, cta: 'Follow Up Call' };
    return { type: 'CALL', urgency: 'MEDIUM', reason: 'Check proposal status', messageKey: null, cta: 'Check In' };
  }
  if (stage === 'NEGOTIATION') {
    if (hoursInactive > 48) return { type: 'CALL', urgency: 'CRITICAL', reason: 'Negotiation stalled 48h — call to close NOW', messageKey: 'CLOSE_DEAL', cta: 'Close Now' };
    return { type: 'CALL', urgency: 'CRITICAL', reason: 'In negotiation — call to close the deal today', messageKey: 'CLOSE_DEAL', cta: 'Close Deal' };
  }
  return { type: 'CALL', urgency: 'LOW', reason: 'General follow-up', messageKey: 'FOLLOW_UP', cta: 'Follow Up' };
}

function spFormatEvent(eventType: string): string {
  const m: Record<string, string> = {
    LEAD_CREATED: 'Lead created', STAGE_CHANGED: 'Stage changed',
    MESSAGE_SENT: 'Message sent', MESSAGE_RECEIVED: 'Message received',
    NOTE_ADDED: 'Note added', CALL_LOGGED: 'Call logged',
    SCORE_UPDATED: 'Score updated', LEAD_ASSIGNED: 'Lead assigned',
  };
  return m[eventType] ?? eventType.toLowerCase().replace(/_/g, ' ');
}

router.get('/sales-panel', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let crmLeads: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      crmLeads = await (prisma as any).crmLead.findMany({
        where: { stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'DISQUALIFIED'] } },
        include: {
          events: {
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: { id: true, eventType: true, payload: true, createdAt: true },
          },
          conversations: {
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, direction: true, channel: true, body: true, status: true, createdAt: true },
              },
            },
          },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch {
      // CRM tables not populated yet — return empty
    }

    const now = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = crmLeads.map((lead: any) => {
      // Last interaction time
      const eventTimes: number[] = (lead.events ?? []).map((e: { createdAt: string | Date }) => new Date(e.createdAt).getTime());
      const msgTimes: number[] = (lead.conversations ?? []).flatMap((c: { messages?: { createdAt: string | Date }[] }) =>
        (c.messages ?? []).map((m: { createdAt: string | Date }) => new Date(m.createdAt).getTime())
      );
      const lastMs = [...eventTimes, ...msgTimes].reduce((max, t) => (t > max ? t : max), 0) || null;
      const hoursInactive = lastMs ? (now - lastMs) / 3_600_000 : 720;

      // Engagement signal
      const allMessages = (lead.conversations ?? [])
        .flatMap((c: { messages?: unknown[] }) => c.messages ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastMsg: any = allMessages[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastEvent: any = (lead.events ?? [])[0];
      let engagementSignal = 'NONE';
      if (lastEvent?.eventType === 'CALL_MISSED') {
        engagementSignal = 'MISSED_CALL';
      } else if (lastMsg) {
        if (lastMsg.direction === 'INBOUND') engagementSignal = 'REPLIED';
        else if (lastMsg.status === 'read') engagementSignal = 'OPENED';
        else if ((now - new Date(lastMsg.createdAt).getTime()) / 3_600_000 > 24) engagementSignal = 'IGNORED';
      }

      // Priority score
      const stageScore = STAGE_PRIORITY_SCORES[lead.stage] ?? 0;
      let recencyScore: number;
      if (hoursInactive < 1) recencyScore = 30;
      else if (hoursInactive < 4) recencyScore = 26;
      else if (hoursInactive < 24) recencyScore = 22;
      else if (hoursInactive < 48) recencyScore = 18;
      else if (hoursInactive < 72) recencyScore = 14;
      else if (hoursInactive < 168) recencyScore = 8;
      else recencyScore = 2;

      const engMap: Record<string, number> = { REPLIED: 20, MISSED_CALL: 15, OPENED: 10, NONE: 5, IGNORED: 0 };
      const priorityScore = Math.min(100, stageScore + recencyScore + (engMap[engagementSignal] ?? 5) + Math.round((lead.score ?? 0) / 10));
      const bucket = priorityScore >= 70 ? 'URGENT' : priorityScore >= 50 ? 'HOT' : priorityScore >= 30 ? 'WARM' : 'COLD';

      // Risk flags
      const riskFlags: string[] = [];
      const ageDays = (now - new Date(lead.createdAt).getTime()) / 86_400_000;
      if (ageDays > 14 && (lead.events ?? []).length < 2) riskFlags.push('COLD_LEAD');
      if (engagementSignal === 'IGNORED' && hoursInactive > 72) riskFlags.push('IGNORED');
      if (lead.stage === 'PROPOSAL_SENT' && hoursInactive > 168) riskFlags.push('AT_RISK');
      if (lead.stage === 'NEGOTIATION' && hoursInactive > 48) riskFlags.push('STALLED');
      if ((lead.systemKw ?? 0) >= 10 && riskFlags.length > 0) riskFlags.push('HIGH_VALUE');

      // Conversion probability
      let prob = CONVERSION_PROB[lead.stage] ?? 0;
      if (engagementSignal === 'REPLIED') prob = Math.min(90, prob + 20);
      if (riskFlags.includes('AT_RISK') || riskFlags.includes('IGNORED')) prob = Math.max(5, prob - 15);

      // Next action + suggested messages
      const na = spCalcNextAction(lead.stage, hoursInactive, engagementSignal);
      const tmpl = na.messageKey ? SP_MSG_TEMPLATES[na.messageKey] : null;
      const firstName = (lead.name as string).split(' ')[0];
      const city = (lead.city as string | null) ?? 'your area';
      const kw = String(lead.systemKw ?? 5);
      const fill = (s: string) => s.replace('{name}', firstName).replace('{city}', city).replace('{kw}', kw);
      const suggestedMessage = tmpl ? { en: fill(tmpl.EN), hi: fill(tmpl.HI), mr: fill(tmpl.MR) } : null;

      // Timeline
      const evItems = (lead.events ?? []).slice(0, 8).map((e: { id: string; eventType: string; payload: Record<string, unknown>; createdAt: string }) => ({
        id: e.id, kind: 'event', eventType: e.eventType,
        description: spFormatEvent(e.eventType),
        detail: (e.payload as Record<string, unknown>)?.toStage ? `→ ${e.payload.toStage}` : null,
        at: e.createdAt,
      }));
      const msgItems = (allMessages as { id: string; direction: string; channel: string; body: string; status: string; createdAt: string }[]).slice(0, 8).map((m) => ({
        id: m.id, kind: 'message', eventType: m.direction === 'INBOUND' ? 'MESSAGE_IN' : 'MESSAGE_OUT',
        description: m.body ? (m.body.length > 80 ? m.body.slice(0, 80) + '…' : m.body) : '(no body)',
        detail: m.channel,
        at: m.createdAt,
      }));
      const timeline = [...evItems, ...msgItems]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 12);

      return {
        id: lead.id, name: lead.name, phone: lead.phone, email: lead.email,
        city: lead.city, language: lead.language ?? 'EN', systemKw: lead.systemKw,
        score: lead.score ?? 0, source: lead.source, stage: lead.stage,
        notes: lead.notes, createdAt: lead.createdAt, assignedTo: lead.assignedTo,
        priorityScore, bucket, hoursInactive: Math.round(hoursInactive),
        engagementSignal, conversionProbability: prob, riskFlags,
        nextAction: { ...na, suggestedMessage },
        timeline,
      };
    });

    enriched.sort((a: { priorityScore: number }, b: { priorityScore: number }) => b.priorityScore - a.priorityScore);
    res.json({ leads: enriched });
  } catch (err) {
    next(err);
  }
});

export default router;
