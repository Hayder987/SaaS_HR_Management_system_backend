/*
  Warnings:

  - The values [FREE] on the enum `PlanName` will be removed. If these variants are still used in the database, this will fail.
  - Made the column `password` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanName_new" AS ENUM ('DEFAULT', 'BASIC', 'GOLD', 'DIAMOND', 'PLATINUM');
ALTER TABLE "public"."users" ALTER COLUMN "planeName" DROP DEFAULT;
ALTER TABLE "plans" ALTER COLUMN "name" TYPE "PlanName_new" USING ("name"::text::"PlanName_new");
ALTER TABLE "users" ALTER COLUMN "planeName" TYPE "PlanName_new" USING ("planeName"::text::"PlanName_new");
ALTER TYPE "PlanName" RENAME TO "PlanName_old";
ALTER TYPE "PlanName_new" RENAME TO "PlanName";
DROP TYPE "public"."PlanName_old";
ALTER TABLE "users" ALTER COLUMN "planeName" SET DEFAULT 'DEFAULT';
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarImg" TEXT,
ALTER COLUMN "password" SET NOT NULL,
ALTER COLUMN "planeName" SET DEFAULT 'DEFAULT';
