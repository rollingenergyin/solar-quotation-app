-- Make cost breakdown fields nullable (schema has String?)
-- Fix existing NULL/invalid offerPageParagraphs
ALTER TABLE "quotation_templates" ALTER COLUMN "costBreakdownSubsidyNote" DROP NOT NULL;
ALTER TABLE "quotation_templates" ALTER COLUMN "costBreakdownNonDcrNote" DROP NOT NULL;

-- Fix existing data: NULL or invalid offerPageParagraphs -> []
UPDATE "quotation_templates"
SET "offerPageParagraphs" = '[]'::jsonb
WHERE "offerPageParagraphs" IS NULL
   OR jsonb_typeof("offerPageParagraphs") != 'array';

-- Fix NULL string fields with defaults
UPDATE "quotation_templates"
SET
  "costBreakdownSubsidyNote" = COALESCE("costBreakdownSubsidyNote", 'Your system qualifies for a government subsidy directly disbursed to your bank account after commissioning. Rolling Energy handles all subsidy paperwork, DISCOM coordination, and documentation end-to-end at no additional charge.'),
  "costBreakdownNonDcrNote" = COALESCE("costBreakdownNonDcrNote", 'Non-DCR (non-domestic content requirement) systems do not qualify for PM Surya Ghar subsidies. However, this system may qualify for accelerated depreciation benefits — see the Depreciation page for details.')
WHERE "costBreakdownSubsidyNote" IS NULL
   OR "costBreakdownNonDcrNote" IS NULL;
