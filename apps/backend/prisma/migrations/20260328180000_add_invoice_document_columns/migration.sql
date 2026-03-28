-- Nullable columns for user-entered invoice number (1, 2, 3…) and document date.
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;
ALTER TABLE "finance_invoices" ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP(3);
