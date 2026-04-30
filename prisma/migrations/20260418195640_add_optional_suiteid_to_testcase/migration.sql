/*
  Warnings:

  - You are about to drop the column `projectId` on the `TestCase` table. All the data in the column will be lost.
  - You are about to drop the `SuiteItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SuiteItem" DROP CONSTRAINT "SuiteItem_suiteId_fkey";

-- DropForeignKey
ALTER TABLE "SuiteItem" DROP CONSTRAINT "SuiteItem_testCaseId_fkey";

-- DropForeignKey
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_projectId_fkey";

-- DropIndex
DROP INDEX "TestCase_projectId_idx";

-- AlterTable
ALTER TABLE "TestCase" DROP COLUMN "projectId",
ADD COLUMN     "suiteId" TEXT;

-- AlterTable
ALTER TABLE "TestSuite" ADD COLUMN     "description" TEXT;

-- DropTable
DROP TABLE "SuiteItem";

-- CreateIndex
CREATE INDEX "TestCase_suiteId_idx" ON "TestCase"("suiteId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
