/*
  Warnings:

  - The values [PAUSED,RESUMED] on the enum `SubscriptionEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [PAST_DUE] on the enum `SubscriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionEventType_new" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'RENEWED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_SUCCEEDED', 'EXPIRED');
ALTER TABLE "SubscriptionEvent" ALTER COLUMN "eventType" TYPE "SubscriptionEventType_new" USING ("eventType"::text::"SubscriptionEventType_new");
ALTER TYPE "SubscriptionEventType" RENAME TO "SubscriptionEventType_old";
ALTER TYPE "SubscriptionEventType_new" RENAME TO "SubscriptionEventType";
DROP TYPE "public"."SubscriptionEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('TRIALING', 'ACTIVE', 'CANCELED', 'EXPIRED', 'INCOMPLETE');
ALTER TABLE "public"."subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "public"."SubscriptionStatus_old";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");
