-- Create finance_sites table (Client → Site hierarchy)
CREATE TABLE "finance_sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_sites_pkey" PRIMARY KEY ("id")
);

-- Add FK for clientId
ALTER TABLE "finance_sites" ADD CONSTRAINT "finance_sites_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "finance_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add finance_site_id to finance_projects
ALTER TABLE "finance_projects" ADD COLUMN "finance_site_id" TEXT;

-- Add FK for projects
ALTER TABLE "finance_projects" ADD CONSTRAINT "finance_projects_finance_site_id_fkey"
  FOREIGN KEY ("finance_site_id") REFERENCES "finance_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop FKs from bank_transactions, transaction_splits, transaction_rules that point to finance_projects
-- (siteId on these tables may reference finance_projects - check current schema)
ALTER TABLE "finance_bank_transactions" DROP CONSTRAINT IF EXISTS "finance_bank_transactions_siteId_fkey";
ALTER TABLE "finance_transaction_splits" DROP CONSTRAINT IF EXISTS "finance_transaction_splits_siteId_fkey";
ALTER TABLE "finance_transaction_rules" DROP CONSTRAINT IF EXISTS "finance_transaction_rules_siteId_fkey";

-- Clear siteId values (they pointed to project IDs, not valid for finance_sites)
UPDATE "finance_bank_transactions" SET "siteId" = NULL;
UPDATE "finance_transaction_splits" SET "siteId" = NULL;
UPDATE "finance_transaction_rules" SET "siteId" = NULL;

-- Add FKs to finance_sites
ALTER TABLE "finance_bank_transactions" ADD CONSTRAINT "finance_bank_transactions_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "finance_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance_transaction_splits" ADD CONSTRAINT "finance_transaction_splits_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "finance_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "finance_transaction_rules" ADD CONSTRAINT "finance_transaction_rules_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "finance_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove old siteId from finance_projects (replaced by finance_site_id)
ALTER TABLE "finance_projects" DROP COLUMN IF EXISTS "siteId";
