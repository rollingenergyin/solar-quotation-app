-- Idempotent: safe to run multiple times.
-- Fixes: column `companyName` missing on `finance_clients` (schema drift / blocked migrations).
ALTER TABLE "finance_clients" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
