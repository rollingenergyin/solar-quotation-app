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
      ADD COLUMN IF NOT EXISTS "version"            INTEGER NOT NULL DEFAULT 1;
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

  await prisma.$disconnect();
}
