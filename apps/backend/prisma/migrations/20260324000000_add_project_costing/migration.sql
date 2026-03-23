-- CreateTable
CREATE TABLE "finance_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "siteId" TEXT,
    "quotationId" TEXT,
    "status" TEXT DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_projects_code_key" ON "finance_projects"("code");

-- Add projectId to purchase_bills and link
ALTER TABLE "finance_purchase_bills" ADD COLUMN "projectId" TEXT;

-- Add projectId to sales_bills and link
ALTER TABLE "finance_sales_bills" ADD COLUMN "projectId" TEXT;

-- Add projectId to stock_movements and link
ALTER TABLE "finance_stock_movements" ADD COLUMN "projectId" TEXT;

-- AddForeignKey (purchase bills)
ALTER TABLE "finance_purchase_bills" ADD CONSTRAINT "finance_purchase_bills_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (sales bills)
ALTER TABLE "finance_sales_bills" ADD CONSTRAINT "finance_sales_bills_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (stock movements)
ALTER TABLE "finance_stock_movements" ADD CONSTRAINT "finance_stock_movements_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Null existing projectIds before adding FK (no projects exist yet)
UPDATE "finance_expenses" SET "projectId" = NULL WHERE "projectId" IS NOT NULL;
UPDATE "finance_incomes" SET "projectId" = NULL WHERE "projectId" IS NOT NULL;

-- AddForeignKey for expense
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for income
ALTER TABLE "finance_incomes" ADD CONSTRAINT "finance_incomes_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "finance_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
