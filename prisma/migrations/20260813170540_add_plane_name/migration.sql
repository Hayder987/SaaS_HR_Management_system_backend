-- AlterEnum
ALTER TYPE "PlanName" ADD VALUE 'FREE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "planeName" "PlanName" NOT NULL DEFAULT 'FREE';
