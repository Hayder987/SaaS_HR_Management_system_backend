/*
  Warnings:

  - Added the required column `onboardingDeadline` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "onboardingDeadline" TIMESTAMP(3) NOT NULL;
