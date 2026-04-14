/**
 * Analytics Engine — dual-track:
 * 1. Real-time: Redis INCR counters (falls back to in-memory in dev)
 * 2. Nightly batch: aggregates event log → analytics_snapshots
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── In-memory fallback for dev (no Redis) ────────────────────────────────────

const inMemoryCounters: Record<string, number> = {};

async function incr(key: string, by = 1): Promise<number> {
  if (!process.env.REDIS_URL) {
    inMemoryCounters[key] = (inMemoryCounters[key] ?? 0) + by;
    return inMemoryCounters[key];
  }
  const { createClient } = await import('redis');
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const val = await client.incrBy(key, by);
  await client.quit();
  return val;
}

async function getCounter(key: string): Promise<number> {
  if (!process.env.REDIS_URL) return inMemoryCounters[key] ?? 0;
  const { createClient } = await import('redis');
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  const val = await client.get(key);
  await client.quit();
  return Number(val ?? 0);
}

// ── Real-time event tracking ─────────────────────────────────────────────────

export async function trackLeadCreated(source: string) {
  const today = todayKey();
  await Promise.all([
    incr(`analytics:${today}:leads_created`),
    incr(`analytics:${today}:leads_created:source:${source}`),
  ]);
}

export async function trackStageChange(from: string, to: string) {
  const today = todayKey();
  await incr(`analytics:${today}:stage_change:${from}_to_${to}`);
}

export async function trackMessageSent(channel: string) {
  const today = todayKey();
  await Promise.all([
    incr(`analytics:${today}:messages_sent`),
    incr(`analytics:${today}:messages_sent:channel:${channel}`),
  ]);
}

export async function trackCampaignSent(campaignId: string) {
  const today = todayKey();
  await incr(`analytics:${today}:campaign_sent:${campaignId}`);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ── Real-time dashboard data ─────────────────────────────────────────────────

export async function getRealTimeStats() {
  const today = todayKey();
  const [leadsToday, messagesToday] = await Promise.all([
    getCounter(`analytics:${today}:leads_created`),
    getCounter(`analytics:${today}:messages_sent`),
  ]);

  const stageCounts = await prisma.crmLead.groupBy({
    by: ['stage'],
    _count: { id: true },
  });

  const sourceCounts = await prisma.crmLead.groupBy({
    by: ['source'],
    _count: { id: true },
  });

  const totalLeads = await prisma.crmLead.count();
  const avgScore = await prisma.crmLead.aggregate({ _avg: { score: true } });

  return {
    today: { leadsCreated: leadsToday, messagesSent: messagesToday },
    funnel: stageCounts.map((s) => ({ stage: s.stage, count: s._count.id })),
    sources: sourceCounts.map((s) => ({ source: s.source, count: s._count.id })),
    totalLeads,
    avgScore: Math.round(avgScore._avg.score ?? 0),
  };
}

// ── Nightly batch aggregation (called by cron at midnight) ───────────────────

export async function runNightlyBatch(date?: Date): Promise<void> {
  const targetDate = date ?? new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate.getTime() + 86_400_000);

  console.log(`[Analytics] Running nightly batch for ${targetDate.toISOString().slice(0, 10)}`);

  // Leads created
  const leadsCreatedBySource = await prisma.crmLead.groupBy({
    by: ['source'],
    where: { createdAt: { gte: targetDate, lt: nextDay } },
    _count: { id: true },
  });
  for (const row of leadsCreatedBySource) {
    await upsertSnapshot(targetDate, 'leads_created', `source:${row.source}`, row._count.id);
  }

  // Stage changes
  const stageEvents = await prisma.crmLeadEvent.findMany({
    where: { eventType: 'STAGE_CHANGED', createdAt: { gte: targetDate, lt: nextDay } },
    select: { fromStage: true, toStage: true },
  });
  const stageMap: Record<string, number> = {};
  for (const e of stageEvents) {
    const key = `${e.fromStage}_to_${e.toStage}`;
    stageMap[key] = (stageMap[key] ?? 0) + 1;
  }
  for (const [dim, count] of Object.entries(stageMap)) {
    await upsertSnapshot(targetDate, 'stage_conversions', dim, count);
  }

  // Messages sent by channel
  const messages = await prisma.crmMessage.groupBy({
    by: ['channel'],
    where: { direction: 'OUTBOUND', sentAt: { gte: targetDate, lt: nextDay } },
    _count: { id: true },
  });
  for (const row of messages) {
    await upsertSnapshot(targetDate, 'messages_sent', `channel:${row.channel}`, row._count.id);
  }

  console.log('[Analytics] Nightly batch complete');
}

async function upsertSnapshot(date: Date, metric: string, dimension: string | null, value: number) {
  await prisma.analyticsSnapshot.upsert({
    where: { date_metric_dimension: { date, metric, dimension: dimension ?? '' } },
    create: { date, metric, dimension, value },
    update: { value },
  });
}

// ── Historical chart data ─────────────────────────────────────────────────────

export async function getHistoricalMetric(
  metric: string,
  dimension: string | null,
  days = 30
): Promise<{ date: string; value: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.analyticsSnapshot.findMany({
    where: {
      metric,
      dimension: dimension ?? undefined,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    value: r.value,
  }));
}
