-- Persistent row order within each bank statement upload (drag-drop).
ALTER TABLE "finance_bank_transactions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: stable order by date then id within each upload
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "uploadId"
      ORDER BY "transactionDate" ASC, "id" ASC
    ) - 1 AS rn
  FROM "finance_bank_transactions"
)
UPDATE "finance_bank_transactions" t
SET "sort_order" = ranked.rn
FROM ranked
WHERE t.id = ranked.id;
