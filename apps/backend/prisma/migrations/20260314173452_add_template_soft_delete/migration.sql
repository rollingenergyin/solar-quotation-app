-- AlterTable
ALTER TABLE "quotation_templates" ADD COLUMN     "isDefaultTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
