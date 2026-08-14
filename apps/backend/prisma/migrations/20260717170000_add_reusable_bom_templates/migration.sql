-- Reusable BOM presets used by single and combined quick quotations.
CREATE TABLE IF NOT EXISTS "bom_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "title" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "bom_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bom_templates_isDeleted_isActive_displayOrder_idx"
  ON "bom_templates"("isDeleted", "isActive", "displayOrder");

DO $$ BEGIN
  ALTER TABLE "bom_templates"
    ADD CONSTRAINT "bom_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
