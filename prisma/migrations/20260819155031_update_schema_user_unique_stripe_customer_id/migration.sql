/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_stripeCustomerId_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "stripeCustomerId";
