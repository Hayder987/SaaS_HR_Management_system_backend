/*
  Warnings:

  - You are about to drop the column `role` on the `memberships` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "memberships_organizationId_role_idx";

-- AlterTable
ALTER TABLE "memberships" DROP COLUMN "role",
ADD COLUMN     "orgRole" "OrgRole" NOT NULL DEFAULT 'EMPLOYEE';

-- CreateIndex
CREATE INDEX "memberships_organizationId_orgRole_idx" ON "memberships"("organizationId", "orgRole");
