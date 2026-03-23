-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "ExpenseCategory" AS ENUM ('SITE_EXPENSE', 'COMMERCIAL_EXPENSE', 'OVERHEADS', 'MARKETING', 'SALARIES', 'FOOD_ACCOMMODATION', 'MISC');
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER');
CREATE TYPE "InvoiceType" AS ENUM ('SPGS', 'PRODUCT', 'SERVICE', 'PROFORMA');
CREATE TYPE "ProductType" AS ENUM ('SPGS', 'EXTERNAL');

-- CreateTable
CREATE TABLE "finance_vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "contact" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "contact" TEXT,
    "address" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_bank_statement_uploads" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_bank_statement_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_bank_transactions" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "referenceNo" TEXT,
    "description" TEXT,
    "partyName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "category" "ExpenseCategory",
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_expenses" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "siteId" TEXT,
    "vendorId" TEXT,
    "paymentMode" "PaymentMode",
    "description" TEXT,
    "billUrl" TEXT,
    "multiSite" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_incomes" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT,
    "siteId" TEXT,
    "clientId" TEXT,
    "paymentMode" "PaymentMode",
    "description" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_purchase_bills" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "gstNumber" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_purchase_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_sales_bills" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "gstNumber" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_sales_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_invoices" (
    "id" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationId" TEXT,
    "items" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsn" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'SPGS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "siteId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_cash_vouchers" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "paymentSource" TEXT,
    "billUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_cash_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_cashflow_snapshots" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "inflows" DOUBLE PRECISION NOT NULL,
    "outflows" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_cashflow_snapshots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "finance_bank_transactions" ADD CONSTRAINT "finance_bank_transactions_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "finance_bank_statement_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "finance_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_purchase_bills" ADD CONSTRAINT "finance_purchase_bills_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "finance_vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_sales_bills" ADD CONSTRAINT "finance_sales_bills_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "finance_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "finance_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_stock_movements" ADD CONSTRAINT "finance_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "finance_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
