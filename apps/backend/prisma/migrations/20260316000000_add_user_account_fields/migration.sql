-- AlterTable: Add new user account fields
ALTER TABLE "users" ADD COLUMN "userId" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "designation" TEXT;
ALTER TABLE "users" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Backfill userId: use id (cuid) for existing users - they login with email
UPDATE "users" SET "userId" = "id" WHERE "userId" IS NULL;

ALTER TABLE "users" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");
