-- Solar Growth OS — All phases DDL (idempotent)

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE "CrmStage" AS ENUM ('NEW','CONTACTED','QUALIFIED','SITE_VISIT_SCHEDULED','SITE_VISIT_DONE','PROPOSAL_SENT','NEGOTIATION','CLOSED_WON','CLOSED_LOST','DISQUALIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeadSource" AS ENUM ('MANUAL','WHATSAPP','SHEET_IMPORT','API','WEBSITE','REFERRAL','CAMPAIGN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LeadLanguage" AS ENUM ('EN','HI','MR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignType" AS ENUM ('BROADCAST','DRIP','BEHAVIORAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Phase 1: CRM ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "crm_leads" (
  "id"           TEXT NOT NULL,
  "phone"        TEXT NOT NULL,
  "phoneHash"    TEXT NOT NULL,
  "email"        TEXT,
  "name"         TEXT NOT NULL,
  "source"       "LeadSource"   NOT NULL DEFAULT 'MANUAL',
  "language"     "LeadLanguage" NOT NULL DEFAULT 'EN',
  "stage"        "CrmStage"     NOT NULL DEFAULT 'NEW',
  "score"        INTEGER NOT NULL DEFAULT 0,
  "assignedToId" TEXT,
  "customerId"   TEXT,
  "metadata"     JSONB NOT NULL DEFAULT '{}',
  "notes"        TEXT,
  "city"         TEXT,
  "state"        TEXT,
  "systemKw"     DOUBLE PRECISION,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_phone_key"     ON "crm_leads"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_phoneHash_key" ON "crm_leads"("phoneHash");
CREATE INDEX IF NOT EXISTS "crm_leads_stage_idx"        ON "crm_leads"("stage");
CREATE INDEX IF NOT EXISTS "crm_leads_assignedToId_idx"  ON "crm_leads"("assignedToId");
CREATE INDEX IF NOT EXISTS "crm_leads_source_idx"        ON "crm_leads"("source");
CREATE INDEX IF NOT EXISTS "crm_leads_score_idx"         ON "crm_leads"("score");

CREATE TABLE IF NOT EXISTS "crm_lead_events" (
  "id"        TEXT NOT NULL,
  "leadId"    TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStage" TEXT,
  "toStage"   TEXT,
  "actor"     TEXT NOT NULL,
  "payload"   JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_lead_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_lead_events_leadId_createdAt_idx" ON "crm_lead_events"("leadId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "crm_lead_events_eventType_idx"        ON "crm_lead_events"("eventType", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "crm_lead_scores" (
  "leadId"          TEXT NOT NULL,
  "score"           INTEGER NOT NULL DEFAULT 0,
  "recencyScore"    INTEGER NOT NULL DEFAULT 0,
  "engagementScore" INTEGER NOT NULL DEFAULT 0,
  "fitScore"        INTEGER NOT NULL DEFAULT 0,
  "calculatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_lead_scores_pkey" PRIMARY KEY ("leadId")
);

-- ── Phase 2: Automation Engine ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "trigger"     JSONB NOT NULL,
  "conditions"  JSONB NOT NULL DEFAULT '[]',
  "actions"     JSONB NOT NULL,
  "loopGuard"   INTEGER NOT NULL DEFAULT 1,
  "priority"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id"             TEXT NOT NULL,
  "ruleId"         TEXT NOT NULL,
  "leadId"         TEXT NOT NULL,
  "triggerEventId" TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "result"         JSONB NOT NULL DEFAULT '{}',
  "startedAt"      TIMESTAMP(3),
  "completedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_executions_idempotency" ON "automation_executions"("ruleId","leadId","triggerEventId");
CREATE INDEX IF NOT EXISTS "automation_executions_leadId_idx"  ON "automation_executions"("leadId");
CREATE INDEX IF NOT EXISTS "automation_executions_status_idx"  ON "automation_executions"("status");

-- ── Phase 3: Message Templates ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "message_templates" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "contentEn" TEXT NOT NULL,
  "contentHi" TEXT,
  "contentMr" TEXT,
  "variables" TEXT[] NOT NULL DEFAULT '{}',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_name_key" ON "message_templates"("name");
CREATE INDEX IF NOT EXISTS "message_templates_category_channel_idx" ON "message_templates"("category","channel");

-- ── Phase 4: Conversations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "crm_conversations" (
  "id"            TEXT NOT NULL,
  "leadId"        TEXT NOT NULL,
  "channel"       TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "context"       JSONB NOT NULL DEFAULT '[]',
  "intent"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_conversations_leadId_channel_key" ON "crm_conversations"("leadId","channel");

CREATE TABLE IF NOT EXISTS "crm_messages" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "direction"      TEXT NOT NULL,
  "channel"        TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "language"       TEXT NOT NULL DEFAULT 'en',
  "status"         TEXT NOT NULL DEFAULT 'SENT',
  "externalId"     TEXT,
  "metadata"       JSONB NOT NULL DEFAULT '{}',
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_messages_conversationId_sentAt_idx" ON "crm_messages"("conversationId","sentAt" DESC);

-- ── Phase 5: Sheet Imports ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sheet_imports" (
  "id"          TEXT NOT NULL,
  "filename"    TEXT NOT NULL,
  "totalRows"   INTEGER NOT NULL DEFAULT 0,
  "imported"    INTEGER NOT NULL DEFAULT 0,
  "duplicates"  INTEGER NOT NULL DEFAULT 0,
  "failed"      INTEGER NOT NULL DEFAULT 0,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "errorReport" JSONB NOT NULL DEFAULT '[]',
  "importedBy"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "sheet_imports_pkey" PRIMARY KEY ("id")
);

-- ── Phase 6: Campaigns ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "type"         "CampaignType"   NOT NULL,
  "status"       "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "channel"      TEXT NOT NULL,
  "targetFilter" JSONB NOT NULL DEFAULT '{}',
  "templateId"   TEXT,
  "scheduledAt"  TIMESTAMP(3),
  "sentCount"    INTEGER NOT NULL DEFAULT 0,
  "openCount"    INTEGER NOT NULL DEFAULT 0,
  "replyCount"   INTEGER NOT NULL DEFAULT 0,
  "createdBy"    TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campaigns_status_scheduledAt_idx" ON "campaigns"("status","scheduledAt");

CREATE TABLE IF NOT EXISTS "drip_steps" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "delayDays"  INTEGER NOT NULL,
  "templateId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "drip_steps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "drip_steps_campaignId_stepNumber_key" ON "drip_steps"("campaignId","stepNumber");

CREATE TABLE IF NOT EXISTS "campaign_enrollments" (
  "id"          TEXT NOT NULL,
  "campaignId"  TEXT NOT NULL,
  "leadId"      TEXT NOT NULL,
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "nextSendAt"  TIMESTAMP(3),
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "stoppedAt"   TIMESTAMP(3),
  "stopReason"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_enrollments_campaignId_leadId_key" ON "campaign_enrollments"("campaignId","leadId");
CREATE INDEX IF NOT EXISTS "campaign_enrollments_status_nextSendAt_idx" ON "campaign_enrollments"("status","nextSendAt");

-- ── Phase 8: Analytics ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
  "id"        TEXT NOT NULL,
  "date"      TIMESTAMP(3) NOT NULL,
  "metric"    TEXT NOT NULL,
  "dimension" TEXT,
  "value"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_snapshots_date_metric_dimension_key" ON "analytics_snapshots"("date","metric","dimension");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_date_metric_idx" ON "analytics_snapshots"("date","metric");
