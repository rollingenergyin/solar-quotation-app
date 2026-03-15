-- AlterTable
ALTER TABLE "quotation_templates" ADD COLUMN     "bomItems" JSONB,
ADD COLUMN     "bomShowQty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bomShowUnit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "sanctionedLoadKw" DOUBLE PRECISION;
