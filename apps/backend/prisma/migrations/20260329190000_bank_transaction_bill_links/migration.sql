-- Link purchase/sales bills to bank transactions or transaction splits (bill attachments).
ALTER TABLE "finance_purchase_bills" ADD COLUMN IF NOT EXISTS "bank_transaction_id" TEXT;
ALTER TABLE "finance_purchase_bills" ADD COLUMN IF NOT EXISTS "transaction_split_id" TEXT;

ALTER TABLE "finance_sales_bills" ADD COLUMN IF NOT EXISTS "bank_transaction_id" TEXT;
ALTER TABLE "finance_sales_bills" ADD COLUMN IF NOT EXISTS "transaction_split_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "finance_purchase_bills_bank_transaction_id_key" ON "finance_purchase_bills"("bank_transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_purchase_bills_transaction_split_id_key" ON "finance_purchase_bills"("transaction_split_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_sales_bills_bank_transaction_id_key" ON "finance_sales_bills"("bank_transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_sales_bills_transaction_split_id_key" ON "finance_sales_bills"("transaction_split_id");

DO $$ BEGIN
  ALTER TABLE "finance_purchase_bills"
    ADD CONSTRAINT "finance_purchase_bills_bank_transaction_id_fkey"
    FOREIGN KEY ("bank_transaction_id") REFERENCES "finance_bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "finance_purchase_bills"
    ADD CONSTRAINT "finance_purchase_bills_transaction_split_id_fkey"
    FOREIGN KEY ("transaction_split_id") REFERENCES "finance_transaction_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "finance_sales_bills"
    ADD CONSTRAINT "finance_sales_bills_bank_transaction_id_fkey"
    FOREIGN KEY ("bank_transaction_id") REFERENCES "finance_bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "finance_sales_bills"
    ADD CONSTRAINT "finance_sales_bills_transaction_split_id_fkey"
    FOREIGN KEY ("transaction_split_id") REFERENCES "finance_transaction_splits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
