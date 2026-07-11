import { PrismaClient } from '@prisma/client';

export interface ProcessTimelineRange {
  minKw: number;
  maxKw: number | null;
  timelineText: string;
}

export const DEFAULT_PROCESS_TIMELINE_RANGES: ProcessTimelineRange[] = [
  { minKw: 0, maxKw: 3, timelineText: 'Total Timeline: 8–12 Working Days' },
  { minKw: 3, maxKw: 10, timelineText: 'Total Timeline: 10–18 Working Days' },
  { minKw: 10, maxKw: null, timelineText: 'Total Timeline: 15–25 Working Days' },
];

export function resolveProcessTimelineText(
  ranges: ProcessTimelineRange[],
  systemKw: number,
  fallback = 'Total Timeline: 10–18 Working Days',
): string {
  if (!ranges.length) return fallback;
  const sorted = [...ranges].sort((a, b) => a.minKw - b.minKw);
  for (const range of sorted) {
    if (systemKw >= range.minKw && (range.maxKw == null || systemKw < range.maxKw)) {
      const text = range.timelineText?.trim();
      if (text) return text;
    }
  }
  return fallback;
}

export function normalizeProcessTimelineRanges(raw: unknown): ProcessTimelineRange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const minKw = Number(row.minKw);
      const maxRaw = row.maxKw;
      const maxKw =
        maxRaw === null || maxRaw === undefined || maxRaw === ''
          ? null
          : Number(maxRaw);
      const timelineText = String(row.timelineText ?? '').trim();
      if (!timelineText || !Number.isFinite(minKw) || minKw < 0) return null;
      if (maxKw != null && (!Number.isFinite(maxKw) || maxKw <= minKw)) return null;
      return { minKw, maxKw, timelineText };
    })
    .filter((r): r is ProcessTimelineRange => r != null);
}

async function ensureGlobalSettingsTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "quotation_global_settings" (
      "id" TEXT NOT NULL DEFAULT 'default',
      "processTimelineRanges" JSONB NOT NULL DEFAULT '[]',
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "quotation_global_settings_pkey" PRIMARY KEY ("id")
    );
  `);
}

async function readStoredRanges(prisma: PrismaClient): Promise<ProcessTimelineRange[] | null> {
  const rows = await prisma.$queryRaw<Array<{ processTimelineRanges: unknown }>>`
    SELECT "processTimelineRanges"
    FROM "quotation_global_settings"
    WHERE "id" = 'default'
    LIMIT 1
  `;
  if (!rows.length) return null;
  const parsed = normalizeProcessTimelineRanges(rows[0].processTimelineRanges);
  return parsed.length > 0 ? parsed : null;
}

async function writeStoredRanges(prisma: PrismaClient, ranges: ProcessTimelineRange[]): Promise<void> {
  const json = JSON.stringify(ranges);
  await prisma.$executeRaw`
    INSERT INTO "quotation_global_settings" ("id", "processTimelineRanges", "updatedAt")
    VALUES ('default', ${json}::jsonb, NOW())
    ON CONFLICT ("id") DO UPDATE
      SET "processTimelineRanges" = EXCLUDED."processTimelineRanges",
          "updatedAt" = NOW()
  `;
}

export async function ensureProcessTimelineSettings(prisma: PrismaClient): Promise<void> {
  await ensureGlobalSettingsTable(prisma);
  const existing = await readStoredRanges(prisma);
  if (existing?.length) return;
  await writeStoredRanges(prisma, DEFAULT_PROCESS_TIMELINE_RANGES);
}

export async function getProcessTimelineRanges(prisma: PrismaClient): Promise<ProcessTimelineRange[]> {
  await ensureProcessTimelineSettings(prisma);
  const stored = await readStoredRanges(prisma);
  return stored ?? DEFAULT_PROCESS_TIMELINE_RANGES;
}

export async function updateProcessTimelineRanges(
  prisma: PrismaClient,
  ranges: ProcessTimelineRange[],
): Promise<ProcessTimelineRange[]> {
  const normalized = normalizeProcessTimelineRanges(ranges);
  if (!normalized.length) {
    throw new Error('At least one timeline range is required');
  }

  await ensureGlobalSettingsTable(prisma);
  await writeStoredRanges(prisma, normalized);
  return normalized;
}

export function applyProcessTimelineToTemplateConfig(
  templateConfig: Record<string, unknown> | null,
  systemKw: number,
  ranges: ProcessTimelineRange[],
): Record<string, unknown> | null {
  if (!templateConfig) return null;
  const fallback = String(templateConfig.processTimelineText ?? 'Total Timeline: 10–18 Working Days');
  return {
    ...templateConfig,
    processTimelineText: resolveProcessTimelineText(ranges, systemKw, fallback),
  };
}

export async function applyGlobalProcessTimelineToPayload(
  prisma: PrismaClient,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const systemKw = Number(payload.systemSizeKw ?? 0);
  const templateConfig = payload.templateConfig as Record<string, unknown> | null;
  if (!templateConfig || !Number.isFinite(systemKw) || systemKw <= 0) {
    return payload;
  }

  const ranges = await getProcessTimelineRanges(prisma);
  return {
    ...payload,
    templateConfig: applyProcessTimelineToTemplateConfig(templateConfig, systemKw, ranges),
  };
}
