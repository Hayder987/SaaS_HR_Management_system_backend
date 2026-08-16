/*
  Warnings:

  - You are about to drop the column `ImageUrl` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "ImageUrl",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);
