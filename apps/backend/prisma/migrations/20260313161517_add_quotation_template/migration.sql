-- CreateTable
CREATE TABLE "quotation_templates" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Default Template',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT NOT NULL DEFAULT 'Rolling Energy',
    "companyTagline" TEXT DEFAULT 'Solar EPC Company',
    "companyAddress" TEXT DEFAULT '2nd Floor, Solar Plaza, Baner Road, Pune 411045, Maharashtra',
    "companyPhone" TEXT DEFAULT '+91 98765 43210',
    "companyEmail" TEXT DEFAULT 'info@rollingenergy.in',
    "companyWebsite" TEXT DEFAULT 'www.rollingenergy.in',
    "introLetterBody" JSONB NOT NULL,
    "aboutParagraphs" JSONB NOT NULL,
    "aboutMission" TEXT NOT NULL,
    "aboutStats" JSONB NOT NULL,
    "aboutHighlights" JSONB NOT NULL,
    "processSteps" JSONB NOT NULL,
    "processTimelineText" TEXT NOT NULL DEFAULT 'Total Timeline: 10–18 Working Days',
    "maintenanceServices" JSONB NOT NULL,
    "warrantyItems" JSONB NOT NULL,
    "paymentMilestones" JSONB NOT NULL,
    "paymentTermsBullets" JSONB NOT NULL,
    "paymentModes" JSONB NOT NULL,
    "whyReasons" JSONB NOT NULL,
    "testimonials" JSONB NOT NULL,
    "certifications" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "quotation_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "quotation_templates" ADD CONSTRAINT "quotation_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
