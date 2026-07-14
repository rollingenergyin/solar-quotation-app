/**
 * Startup schema fix — runs idempotent DDL to create any tables / columns
 * that are missing from the production database.
 *
 * All statements use IF NOT EXISTS / DO…EXCEPTION so they are safe to
 * execute on every boot and will never fail if the object already exists.
 *
 * This bypass is needed because Prisma migrate deploy can fail when the
 * production _prisma_migrations history is inconsistent.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function exec(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function createEnum(name: string, values: string[]) {
  const list = values.map((v) => `'${v}'`).join(', ');
  await exec(`
    DO $$ BEGIN
      CREATE TYPE "${name}" AS ENUM (${list});
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function runStartupSchemaFix() {
  // ── Enums ────────────────────────────────────────────────────────────────
  await createEnum('AttendanceStatus', ['NONE', 'IN_PROGRESS', 'COMPLETE', 'ABSENT', 'ON_LEAVE', 'HOLIDAY']);
  await createEnum('LeaveType',        ['PLANNED', 'EMERGENCY', 'SICK', 'CASUAL']);
  await createEnum('LeaveStatus',      ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
  await createEnum('CompOffStatus',    ['PENDING', 'APPROVED', 'REJECTED', 'USED']);
  await createEnum('WorkflowType',     ['PRICING', 'DISCOUNT', 'COMPLAINT', 'OTHER']);
  await createEnum('WorkflowStatus',   ['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED']);

  // ── Quotation columns (added after initial schema) ───────────────────────
  await exec(`
    ALTER TABLE "quotations"
      ADD COLUMN IF NOT EXISTS "sanctioned_load_increased_to_kw" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "inverterSizeKw"     DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "quotationDataJson"  JSONB,
      ADD COLUMN IF NOT EXISTS "generatedPdfPath"   TEXT,
      ADD COLUMN IF NOT EXISTS "parentQuotationId"  TEXT,
      ADD COLUMN IF NOT EXISTS "version"            INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "isPricingLocked"    BOOLEAN NOT NULL DEFAULT false;
  `);

  await exec(`
    DO $$ BEGIN
      ALTER TYPE "QuotationStatus" ADD VALUE 'REVIEW';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // ── Quotation template columns (added after initial template schema) ──────
  // bankDetails / bomOptions migrations exist, but production may not apply
  // them when _prisma_migrations history has drifted. Keep these idempotent.
  await exec(`
    ALTER TABLE "quotation_templates"
      ADD COLUMN IF NOT EXISTS "bankDetails" JSONB,
      ADD COLUMN IF NOT EXISTS "bomOptions" JSONB;
  `);

  // ── Quotation global settings (process timeline singleton) ───────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS "quotation_global_settings" (
      "id" TEXT NOT NULL DEFAULT 'default',
      "processTimelineRanges" JSONB NOT NULL DEFAULT '[]',
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "quotation_global_settings_pkey" PRIMARY KEY ("id")
    );
  `);

  await exec(`
    ALTER TABLE "quotation_global_settings"
      ADD COLUMN IF NOT EXISTS "processTimelineRanges" JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS "defaultProfitMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
      ADD COLUMN IF NOT EXISTS "siteCostingRates" JSONB NOT NULL DEFAULT '{}';
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "quotation_sequence" (
      "id"        TEXT    NOT NULL DEFAULT 'main',
      "nextValue" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      CONSTRAINT "quotation_sequence_pkey" PRIMARY KEY ("id")
    );
  `);

  // ── Attendance tables ────────────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_policy" (
      "id"                TEXT    NOT NULL,
      "userId"            TEXT,
      "workStartTime"     TEXT    NOT NULL DEFAULT '09:30',
      "workEndTime"       TEXT    NOT NULL DEFAULT '18:30',
      "graceMinutes"      INTEGER NOT NULL DEFAULT 15,
      "lateAfterMinutes"  INTEGER NOT NULL DEFAULT 30,
      "sundayCompOffAuto" BOOLEAN NOT NULL DEFAULT true,
      "effectiveFrom"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_policy_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "attendance_policy_userId_key" ON "attendance_policy"("userId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_days" (
      "id"          TEXT NOT NULL,
      "userId"      TEXT NOT NULL,
      "date"        TEXT NOT NULL,
      "status"      "AttendanceStatus" NOT NULL DEFAULT 'NONE',
      "isLate"      BOOLEAN NOT NULL DEFAULT false,
      "lateMinutes" INTEGER NOT NULL DEFAULT 0,
      "isSunday"    BOOLEAN NOT NULL DEFAULT false,
      "dailyUpdate" TEXT,
      "tomorrowPlan" TEXT,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "attendance_days_userId_date_key" ON "attendance_days"("userId", "date");`);
  await exec(`CREATE INDEX IF NOT EXISTS "attendance_days_userId_idx" ON "attendance_days"("userId");`);
  await exec(`CREATE INDEX IF NOT EXISTS "attendance_days_date_idx"   ON "attendance_days"("date");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_check_ins" (
      "id"               TEXT NOT NULL,
      "attendanceDayId"  TEXT NOT NULL,
      "capturedAt"       TIMESTAMP(3) NOT NULL,
      "clientCapturedAt" TIMESTAMP(3),
      "selfieKey"        TEXT NOT NULL,
      "selfieHash"       TEXT,
      "lat"              DOUBLE PRECISION,
      "lng"              DOUBLE PRECISION,
      "accuracyM"        DOUBLE PRECISION,
      "description"      TEXT NOT NULL,
      "workLocation"     TEXT,
      "deviceInfo"       TEXT,
      "syncBatchId"      TEXT,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_check_ins_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "attendance_check_ins_attendanceDayId_key" ON "attendance_check_ins"("attendanceDayId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_check_outs" (
      "id"               TEXT NOT NULL,
      "attendanceDayId"  TEXT NOT NULL,
      "capturedAt"       TIMESTAMP(3) NOT NULL,
      "clientCapturedAt" TIMESTAMP(3),
      "selfieKey"        TEXT,
      "lat"              DOUBLE PRECISION,
      "lng"              DOUBLE PRECISION,
      "accuracyM"        DOUBLE PRECISION,
      "description"      TEXT NOT NULL,
      "workLocation"     TEXT,
      "fullDayUpdate"    TEXT,
      "nextDayPlan"      TEXT,
      "syncBatchId"      TEXT,
      "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_check_outs_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "attendance_check_outs_attendanceDayId_key" ON "attendance_check_outs"("attendanceDayId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_corrections" (
      "id"              TEXT NOT NULL,
      "attendanceDayId" TEXT NOT NULL,
      "adminId"         TEXT NOT NULL,
      "fieldChanged"    TEXT NOT NULL,
      "oldValue"        TEXT,
      "newValue"        TEXT,
      "reason"          TEXT NOT NULL,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "attendance_corrections_attendanceDayId_idx" ON "attendance_corrections"("attendanceDayId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "leave_requests" (
      "id"                     TEXT NOT NULL,
      "userId"                 TEXT NOT NULL,
      "startDate"              TEXT NOT NULL,
      "endDate"                TEXT NOT NULL,
      "type"                   "LeaveType"   NOT NULL,
      "reason"                 TEXT NOT NULL,
      "status"                 "LeaveStatus" NOT NULL DEFAULT 'PENDING',
      "approverId"             TEXT,
      "decidedAt"              TIMESTAMP(3),
      "emergencyJustification" TEXT,
      "advanceDaysSatisfied"   BOOLEAN NOT NULL DEFAULT false,
      "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "leave_requests_userId_idx" ON "leave_requests"("userId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "comp_off_requests" (
      "id"              TEXT NOT NULL,
      "userId"          TEXT NOT NULL,
      "workDate"        TEXT NOT NULL,
      "attendanceDayId" TEXT,
      "status"          "CompOffStatus" NOT NULL DEFAULT 'PENDING',
      "approverId"      TEXT,
      "decidedAt"       TIMESTAMP(3),
      "note"            TEXT,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "comp_off_requests_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "comp_off_requests_attendanceDayId_key" ON "comp_off_requests"("attendanceDayId");`);
  await exec(`CREATE INDEX IF NOT EXISTS "comp_off_requests_userId_idx" ON "comp_off_requests"("userId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "workflow_requests" (
      "id"          TEXT NOT NULL,
      "type"        "WorkflowType"   NOT NULL,
      "requesterId" TEXT NOT NULL,
      "title"       TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "payload"     JSONB,
      "status"      "WorkflowStatus" NOT NULL DEFAULT 'OPEN',
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workflow_requests_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "workflow_requests_requesterId_idx" ON "workflow_requests"("requesterId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "workflow_approvals" (
      "id"         TEXT NOT NULL,
      "requestId"  TEXT NOT NULL,
      "approverId" TEXT NOT NULL,
      "decision"   TEXT NOT NULL,
      "comment"    TEXT,
      "decidedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "attendance_notifications" (
      "id"        TEXT NOT NULL,
      "userId"    TEXT NOT NULL,
      "type"      TEXT NOT NULL,
      "title"     TEXT NOT NULL,
      "message"   TEXT NOT NULL,
      "readAt"    TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "attendance_notifications_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "attendance_notifications_userId_idx" ON "attendance_notifications"("userId");`);

  // ── Solar Growth OS tables ──────────────────────────────────────────────────
  await createEnum('CrmStage', ['NEW','CONTACTED','QUALIFIED','SITE_VISIT_SCHEDULED','SITE_VISIT_DONE','PROPOSAL_SENT','NEGOTIATION','CLOSED_WON','CLOSED_LOST','DISQUALIFIED']);
  await createEnum('LeadSource', ['MANUAL','WHATSAPP','SHEET_IMPORT','API','WEBSITE','REFERRAL','CAMPAIGN']);
  await createEnum('LeadLanguage', ['EN','HI','MR']);
  await createEnum('CampaignType', ['BROADCAST','DRIP','BEHAVIORAL']);
  await createEnum('CampaignStatus', ['DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED']);

  await exec(`
    CREATE TABLE IF NOT EXISTS "crm_leads" (
      "id" TEXT NOT NULL, "phone" TEXT NOT NULL, "phoneHash" TEXT NOT NULL, "email" TEXT,
      "name" TEXT NOT NULL, "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
      "language" "LeadLanguage" NOT NULL DEFAULT 'EN', "stage" "CrmStage" NOT NULL DEFAULT 'NEW',
      "score" INTEGER NOT NULL DEFAULT 0, "assignedToId" TEXT, "customerId" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}', "notes" TEXT, "city" TEXT, "state" TEXT,
      "systemKw" DOUBLE PRECISION, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_phone_key" ON "crm_leads"("phone");`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_phoneHash_key" ON "crm_leads"("phoneHash");`);
  await exec(`CREATE INDEX IF NOT EXISTS "crm_leads_stage_idx" ON "crm_leads"("stage");`);
  await exec(`CREATE INDEX IF NOT EXISTS "crm_leads_score_idx" ON "crm_leads"("score");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "crm_lead_events" (
      "id" TEXT NOT NULL, "leadId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
      "fromStage" TEXT, "toStage" TEXT, "actor" TEXT NOT NULL,
      "payload" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_lead_events_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "crm_lead_events_leadId_idx" ON "crm_lead_events"("leadId","createdAt" DESC);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "crm_lead_scores" (
      "leadId" TEXT NOT NULL, "score" INTEGER NOT NULL DEFAULT 0,
      "recencyScore" INTEGER NOT NULL DEFAULT 0, "engagementScore" INTEGER NOT NULL DEFAULT 0,
      "fitScore" INTEGER NOT NULL DEFAULT 0, "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_lead_scores_pkey" PRIMARY KEY ("leadId")
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "automation_rules" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true, "trigger" JSONB NOT NULL,
      "conditions" JSONB NOT NULL DEFAULT '[]', "actions" JSONB NOT NULL,
      "loopGuard" INTEGER NOT NULL DEFAULT 1, "priority" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "automation_executions" (
      "id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
      "triggerEventId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
      "attempts" INTEGER NOT NULL DEFAULT 0, "result" JSONB NOT NULL DEFAULT '{}',
      "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "automation_executions_idempotency" ON "automation_executions"("ruleId","leadId","triggerEventId");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "message_templates" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "channel" TEXT NOT NULL,
      "contentEn" TEXT NOT NULL, "contentHi" TEXT, "contentMr" TEXT,
      "variables" TEXT[] NOT NULL DEFAULT '{}', "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_name_key" ON "message_templates"("name");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "crm_conversations" (
      "id" TEXT NOT NULL, "leadId" TEXT NOT NULL, "channel" TEXT NOT NULL,
      "lastMessageAt" TIMESTAMP(3), "context" JSONB NOT NULL DEFAULT '[]', "intent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_conversations_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "crm_conversations_leadId_channel_key" ON "crm_conversations"("leadId","channel");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "crm_messages" (
      "id" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "direction" TEXT NOT NULL,
      "channel" TEXT NOT NULL, "content" TEXT NOT NULL, "language" TEXT NOT NULL DEFAULT 'en',
      "status" TEXT NOT NULL DEFAULT 'SENT', "externalId" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}', "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "crm_messages_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "crm_messages_conv_idx" ON "crm_messages"("conversationId","sentAt" DESC);`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "sheet_imports" (
      "id" TEXT NOT NULL, "filename" TEXT NOT NULL, "totalRows" INTEGER NOT NULL DEFAULT 0,
      "imported" INTEGER NOT NULL DEFAULT 0, "duplicates" INTEGER NOT NULL DEFAULT 0,
      "failed" INTEGER NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'PENDING',
      "errorReport" JSONB NOT NULL DEFAULT '[]', "importedBy" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
      CONSTRAINT "sheet_imports_pkey" PRIMARY KEY ("id")
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "campaigns" (
      "id" TEXT NOT NULL, "name" TEXT NOT NULL, "type" "CampaignType" NOT NULL,
      "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT', "channel" TEXT NOT NULL,
      "targetFilter" JSONB NOT NULL DEFAULT '{}', "templateId" TEXT, "scheduledAt" TIMESTAMP(3),
      "sentCount" INTEGER NOT NULL DEFAULT 0, "openCount" INTEGER NOT NULL DEFAULT 0,
      "replyCount" INTEGER NOT NULL DEFAULT 0, "createdBy" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "drip_steps" (
      "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "stepNumber" INTEGER NOT NULL,
      "delayDays" INTEGER NOT NULL, "templateId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "drip_steps_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "drip_steps_campaignId_stepNumber_key" ON "drip_steps"("campaignId","stepNumber");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "campaign_enrollments" (
      "id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "leadId" TEXT NOT NULL,
      "currentStep" INTEGER NOT NULL DEFAULT 0, "nextSendAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'ACTIVE', "stoppedAt" TIMESTAMP(3), "stopReason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "campaign_enrollments_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "campaign_enrollments_campaignId_leadId_key" ON "campaign_enrollments"("campaignId","leadId");`);
  await exec(`CREATE INDEX IF NOT EXISTS "campaign_enrollments_status_nextSendAt_idx" ON "campaign_enrollments"("status","nextSendAt");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
      "id" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "metric" TEXT NOT NULL,
      "dimension" TEXT, "value" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "analytics_snapshots_date_metric_dimension_key" ON "analytics_snapshots"("date","metric","dimension");`);

  // ── Phase 10: Social Media Automation ────────────────────────────────────

  await createEnum('SocialSegment', ['RESIDENTIAL','SOCIETY','COMMERCIAL','INDUSTRIAL','GROUND_MOUNT']);
  await createEnum('SocialContentType', ['STATIC_POST','CAROUSEL','REEL']);
  await createEnum('SocialPostStatus', ['DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','SCHEDULED','POSTED','FAILED']);

  await exec(`
    CREATE TABLE IF NOT EXISTS "social_calendar_slots" (
      "id" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "slotType" TEXT NOT NULL,
      "theme" TEXT NOT NULL, "segment" TEXT, "isNewsSlot" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_calendar_slots_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE INDEX IF NOT EXISTS "social_calendar_slots_date_idx" ON "social_calendar_slots"("date");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "social_posts" (
      "id" TEXT NOT NULL, "title" TEXT NOT NULL,
      "segment" "SocialSegment" NOT NULL, "contentType" "SocialContentType" NOT NULL,
      "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
      "captionEn" TEXT NOT NULL, "captionHi" TEXT NOT NULL, "captionMr" TEXT NOT NULL,
      "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "visualConcept" TEXT NOT NULL, "mediaUrl" TEXT, "platforms" TEXT[] NOT NULL DEFAULT ARRAY['instagram','facebook']::TEXT[],
      "scheduledAt" TIMESTAMP(3), "postedAt" TIMESTAMP(3),
      "isNewsSlot" BOOLEAN NOT NULL DEFAULT false, "rejectionNote" TEXT,
      "productionSpec" JSONB, "currentVersion" INTEGER NOT NULL DEFAULT 1,
      "slotId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_slotId_key" ON "social_posts"("slotId") WHERE "slotId" IS NOT NULL;`);
  await exec(`CREATE INDEX IF NOT EXISTS "social_posts_status_scheduledAt_idx" ON "social_posts"("status","scheduledAt");`);
  await exec(`CREATE INDEX IF NOT EXISTS "social_posts_segment_contentType_idx" ON "social_posts"("segment","contentType");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "social_platform_credentials" (
      "id" TEXT NOT NULL, "platform" TEXT NOT NULL, "displayName" TEXT NOT NULL,
      "accessToken" TEXT NOT NULL, "refreshToken" TEXT, "pageId" TEXT,
      "expiresAt" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_platform_credentials_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "social_platform_credentials_platform_key" ON "social_platform_credentials"("platform");`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "social_post_analytics" (
      "id" TEXT NOT NULL, "postId" TEXT NOT NULL, "platform" TEXT NOT NULL,
      "likes" INTEGER NOT NULL DEFAULT 0, "comments" INTEGER NOT NULL DEFAULT 0,
      "shares" INTEGER NOT NULL DEFAULT 0, "reach" INTEGER NOT NULL DEFAULT 0,
      "clicks" INTEGER NOT NULL DEFAULT 0,
      "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_post_analytics_pkey" PRIMARY KEY ("id")
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "social_post_analytics_postId_key" ON "social_post_analytics"("postId");`);

  // Idempotent column additions for social_posts
  await exec(`ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "productionSpec" JSONB;`);
  await exec(`ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;`);

  await exec(`
    CREATE TABLE IF NOT EXISTS "social_post_versions" (
      "id" TEXT NOT NULL, "postId" TEXT NOT NULL, "version" INTEGER NOT NULL,
      "label" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
      "editedBy" TEXT, "changeNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "social_post_versions_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "social_post_versions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "social_posts"("id") ON DELETE CASCADE
    );
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "social_post_versions_postId_version_key" ON "social_post_versions"("postId","version");`);
  await exec(`CREATE INDEX IF NOT EXISTS "social_post_versions_postId_idx" ON "social_post_versions"("postId");`);

  await prisma.$disconnect();
}
