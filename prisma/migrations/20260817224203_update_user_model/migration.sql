-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_isOwner_idx" ON "users"("isOwner");

-- CreateIndex
CREATE INDEX "users_isPremium_idx" ON "users"("isPremium");
