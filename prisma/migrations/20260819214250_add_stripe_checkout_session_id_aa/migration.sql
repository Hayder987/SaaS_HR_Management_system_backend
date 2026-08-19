/*
  Warnings:

  - You are about to alter the column `storageUsedBytes` on the `organizations` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "storageUsedBytes" SET DATA TYPE INTEGER;
