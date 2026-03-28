-- CreateTable
CREATE TABLE "finance_invoice_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_invoice_templates_slug_key" ON "finance_invoice_templates"("slug");

-- AlterTable
ALTER TABLE "finance_invoices" ADD COLUMN "template_id" TEXT;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "finance_invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
