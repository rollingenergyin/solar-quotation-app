-- AlterEnum
ALTER TYPE "SiteType" ADD VALUE 'INDUSTRIAL';

-- AlterTable
ALTER TABLE "quotation_templates" ADD COLUMN     "siteType" TEXT NOT NULL DEFAULT 'ANY',
ADD COLUMN     "systemType" TEXT NOT NULL DEFAULT 'ANY';
