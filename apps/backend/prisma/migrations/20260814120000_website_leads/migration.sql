-- CreateEnum
CREATE TYPE "WebsiteLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'QUOTATION', 'NEGOTIATION', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "website_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "message" TEXT,
    "requirementType" TEXT NOT NULL,
    "solarCapacity" DOUBLE PRECISION,
    "bessCapacity" DOUBLE PRECISION,
    "monthlyElectricityBill" DOUBLE PRECISION,
    "monthlyUnits" DOUBLE PRECISION,
    "connectedLoad" DOUBLE PRECISION,
    "maximumDemand" DOUBLE PRECISION,
    "contractDemand" DOUBLE PRECISION,
    "backupRequirement" TEXT,
    "operatingHours" DOUBLE PRECISION,
    "solarCalculatorResults" JSONB,
    "bessCalculatorResults" JSONB,
    "sourcePage" TEXT,
    "sourceType" TEXT,
    "status" "WebsiteLeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "notes" TEXT,
    "quotationId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "landingPage" TEXT,
    "referrer" TEXT,

    CONSTRAINT "website_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "website_leads_status_idx" ON "website_leads"("status");
CREATE INDEX "website_leads_assignedToId_idx" ON "website_leads"("assignedToId");
CREATE INDEX "website_leads_sourceType_idx" ON "website_leads"("sourceType");
CREATE INDEX "website_leads_createdAt_idx" ON "website_leads"("createdAt");
CREATE INDEX "website_leads_email_idx" ON "website_leads"("email");
CREATE INDEX "website_leads_phone_idx" ON "website_leads"("phone");

ALTER TABLE "website_leads" ADD CONSTRAINT "website_leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "website_leads" ADD CONSTRAINT "website_leads_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
