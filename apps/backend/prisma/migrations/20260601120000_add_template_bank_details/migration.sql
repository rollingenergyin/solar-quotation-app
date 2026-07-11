-- AlterTable
ALTER TABLE "quotation_templates" ADD COLUMN IF NOT EXISTS "bankDetails" JSONB;
