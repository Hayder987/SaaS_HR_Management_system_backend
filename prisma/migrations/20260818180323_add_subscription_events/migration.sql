/*
  Warnings:

  - You are about to drop the `subscription_events` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('CREATED', 'UPDATED', 'ACTIVATED', 'RENEWED', 'CANCELLED', 'PAUSED', 'RESUMED', 'PAYMENT_FAILED', 'PAYMENT_SUCCEEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE', 'BKASH', 'SSLCOMMERZ');

-- DropForeignKey
ALTER TABLE "subscription_events" DROP CONSTRAINT "subscription_events_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_organizationId_fkey";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'STRIPE';

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "userId" UUID NOT NULL,
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';

-- DropTable
DROP TABLE "subscription_events";

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "eventType" "SubscriptionEventType" NOT NULL,
    "stripeEventId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
