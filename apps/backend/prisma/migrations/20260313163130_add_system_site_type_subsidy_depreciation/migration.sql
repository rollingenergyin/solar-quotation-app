/*
  Warnings:

  - Added the required column `depreciationTable` to the `quotation_templates` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SystemType" AS ENUM ('DCR', 'NON_DCR');

-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('RESIDENTIAL', 'SOCIETY', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "quotation_templates" ADD COLUMN     "depreciationNote" TEXT NOT NULL DEFAULT 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules. Assets used for business purposes are eligible for depreciation under the Income Tax Act.',
ADD COLUMN     "depreciationTable" JSONB NOT NULL DEFAULT '[{"year":"Year 1","rate":"40%","note":"WDV accelerated depreciation"},{"year":"Year 2","rate":"24%","note":"40% on remaining 60%"},{"year":"Year 3","rate":"14.4%","note":"40% on remaining 36%"},{"year":"Year 4+","rate":"8.6%","note":"Diminishing balance"}]',
ADD COLUMN     "subsidyResidential1kw" DOUBLE PRECISION NOT NULL DEFAULT 30000,
ADD COLUMN     "subsidyResidential2kw" DOUBLE PRECISION NOT NULL DEFAULT 60000,
ADD COLUMN     "subsidyResidential3to10kw" DOUBLE PRECISION NOT NULL DEFAULT 78000,
ADD COLUMN     "subsidySocietyPerKw" DOUBLE PRECISION NOT NULL DEFAULT 18000;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "siteType" "SiteType" NOT NULL DEFAULT 'RESIDENTIAL',
ADD COLUMN     "systemType" "SystemType" NOT NULL DEFAULT 'DCR';
