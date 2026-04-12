-- Allow multiple templates per subtype; track which one is active per type.
ALTER TABLE "finance_invoice_templates" DROP CONSTRAINT IF EXISTS "finance_invoice_templates_subtype_key";

ALTER TABLE "finance_invoice_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "finance_invoice_templates_subtype_idx" ON "finance_invoice_templates"("subtype");

-- Mark canonical system templates (by slug) as active.
UPDATE "finance_invoice_templates"
SET "is_active" = true
WHERE "slug" IN ('system-spgs', 'system-service', 'system-product');

-- For any subtype with no active row, activate the oldest row.
WITH first AS (
  SELECT DISTINCT ON ("subtype") id AS "id", "subtype"
  FROM "finance_invoice_templates"
  ORDER BY "subtype", "createdAt" ASC
)
UPDATE "finance_invoice_templates" t
SET "is_active" = true
FROM first f
WHERE t.id = f.id
AND NOT EXISTS (
  SELECT 1 FROM "finance_invoice_templates" x
  WHERE x."subtype" = t."subtype" AND x."is_active" = true
);
