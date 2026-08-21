/*
  Warnings:

  - The values [CREATED] on the enum `SubscriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `paymentMethod` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isOwner` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isPremium` on the `users` table. All the data in the column will be lost.
  - Made the column `organizationId` on table `subscriptions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "paymentMethod" AS ENUM ('STRIPE', 'BKASH', 'SSLCOMMERZ');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionStatus_new" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED', 'INCOMPLETE');
ALTER TABLE "public"."subscriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "status" TYPE "SubscriptionStatus_new" USING ("status"::text::"SubscriptionStatus_new");
ALTER TYPE "SubscriptionStatus" RENAME TO "SubscriptionStatus_old";
ALTER TYPE "SubscriptionStatus_new" RENAME TO "SubscriptionStatus";
DROP TYPE "public"."SubscriptionStatus_old";
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';
COMMIT;

-- DropForeignKey
ALTER TABLE "auditLog" DROP CONSTRAINT "auditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "employee_leave_requests" DROP CONSTRAINT "employee_leave_requests_reviewedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "leave_approvals" DROP CONSTRAINT "leave_approvals_approverUserId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropIndex
DROP INDEX "subscriptions_stripeCustomerId_key";

-- DropIndex
DROP INDEX "users_isOwner_idx";

-- DropIndex
DROP INDEX "users_isPremium_idx";

-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "trialDays" SET DEFAULT 7;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" "paymentMethod" NOT NULL DEFAULT 'STRIPE';

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "stripeCustomerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isOwner",
DROP COLUMN "isPremium",
ADD COLUMN     "activeOrgId" TEXT;

-- DropEnum
DROP TYPE "PaymentMethod";

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
