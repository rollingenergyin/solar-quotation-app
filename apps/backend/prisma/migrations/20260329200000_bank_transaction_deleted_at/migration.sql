-- Soft-delete (recycle bin) for bank statement rows
ALTER TABLE "finance_bank_transactions" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
