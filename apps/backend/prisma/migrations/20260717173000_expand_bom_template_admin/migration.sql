-- Add centralized administration fields to existing BOM template libraries.
ALTER TABLE "bom_templates"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "bom_templates_isDeleted_isActive_displayOrder_idx"
  ON "bom_templates"("isDeleted", "isActive", "displayOrder");

-- Keep at most one existing template as the initial default.
UPDATE "bom_templates"
SET "isDefault" = true
WHERE "id" = (
  SELECT "id"
  FROM "bom_templates"
  WHERE "isDeleted" = false
  ORDER BY "displayOrder" ASC, "createdAt" ASC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "bom_templates" WHERE "isDefault" = true AND "isDeleted" = false
);
