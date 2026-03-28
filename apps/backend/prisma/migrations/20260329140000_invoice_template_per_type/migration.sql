-- One layout per invoice type. Clears legacy multi-template rows (IDs are not preserved).
UPDATE "finance_invoices" SET "template_id" = NULL;

DELETE FROM "finance_invoice_templates";

ALTER TABLE "finance_invoice_templates" DROP COLUMN IF EXISTS "isDefault";

ALTER TABLE "finance_invoice_templates" ADD COLUMN "invoice_type" "InvoiceType" NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "finance_invoice_templates_invoice_type_key" ON "finance_invoice_templates"("invoice_type");
