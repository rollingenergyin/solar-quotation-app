-- User-entered invoice number and document date (idempotent; may duplicate 20260328180000 on some DBs).
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP(3);
