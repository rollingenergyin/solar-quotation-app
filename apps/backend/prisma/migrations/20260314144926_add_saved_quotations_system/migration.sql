-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('QUICK', 'NORMAL');

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "generatedPdfPath" TEXT,
ADD COLUMN     "parentQuotationId" TEXT,
ADD COLUMN     "quotationDataJson" JSONB,
ADD COLUMN     "quotationType" "QuotationType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "quotation_sequence" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_sequence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_parentQuotationId_fkey" FOREIGN KEY ("parentQuotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
