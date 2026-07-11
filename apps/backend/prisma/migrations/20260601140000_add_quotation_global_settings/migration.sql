CREATE TABLE IF NOT EXISTS "quotation_global_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "processTimelineRanges" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotation_global_settings_pkey" PRIMARY KEY ("id")
);
