-- Main kind + subtype; 3 subtype-only templates; sequences per main kind.

CREATE TYPE "InvoiceMainKind" AS ENUM ('TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL');
CREATE TYPE "InvoiceSubtype" AS ENUM ('SPGS', 'SERVICE', 'PRODUCT');

ALTER TABLE "finance_invoices" ADD COLUMN "main_kind" "InvoiceMainKind";
ALTER TABLE "finance_invoices" ADD COLUMN "subtype" "InvoiceSubtype";
ALTER TABLE "finance_invoices" ADD COLUMN "converted_from_id" TEXT;

UPDATE "finance_invoices" SET
  "main_kind" = CASE
    WHEN "type"::text = 'PROFORMA' THEN 'PROFORMA_INVOICE'::"InvoiceMainKind"
    ELSE 'TAX_INVOICE'::"InvoiceMainKind"
  END,
  "subtype" = CASE
    WHEN "type"::text = 'SPGS' THEN 'SPGS'::"InvoiceSubtype"
    WHEN "type"::text = 'SERVICE' THEN 'SERVICE'::"InvoiceSubtype"
    WHEN "type"::text = 'PRODUCT' THEN 'PRODUCT'::"InvoiceSubtype"
    WHEN "type"::text = 'PROFORMA' THEN 'SPGS'::"InvoiceSubtype"
    ELSE 'PRODUCT'::"InvoiceSubtype"
  END;

ALTER TABLE "finance_invoices" ALTER COLUMN "main_kind" SET NOT NULL;
ALTER TABLE "finance_invoices" ALTER COLUMN "subtype" SET NOT NULL;

UPDATE "finance_invoices" SET "template_id" = NULL;

DELETE FROM "finance_invoice_templates";
ALTER TABLE "finance_invoice_templates" DROP COLUMN IF EXISTS "invoice_type";
DROP INDEX IF EXISTS "finance_invoice_templates_invoice_type_key";

ALTER TABLE "finance_invoices" DROP COLUMN "type";
DROP TYPE "InvoiceType";

ALTER TABLE "finance_invoice_templates" ADD COLUMN "subtype" "InvoiceSubtype" NOT NULL;

CREATE UNIQUE INDEX "finance_invoice_templates_subtype_key" ON "finance_invoice_templates"("subtype");

ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_converted_from_id_fkey" FOREIGN KEY ("converted_from_id") REFERENCES "finance_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "finance_invoice_sequences" (
    "main_kind" "InvoiceMainKind" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_invoice_sequences_pkey" PRIMARY KEY ("main_kind")
);
