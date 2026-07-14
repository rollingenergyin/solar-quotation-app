-- Ensure quotation_templates / global settings columns exist in production
-- when earlier migration history drifted and migrate deploy could not apply
-- 20260601120000 / 20260601140000 / 20260601150000.
-- All statements are idempotent (IF NOT EXISTS).

ALTER TABLE "quotation_templates" ADD COLUMN IF NOT EXISTS "bankDetails" JSONB;
ALTER TABLE "quotation_templates" ADD COLUMN IF NOT EXISTS "bomOptions" JSONB;

CREATE TABLE IF NOT EXISTS "quotation_global_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "processTimelineRanges" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotation_global_settings_pkey" PRIMARY KEY ("id")
);
