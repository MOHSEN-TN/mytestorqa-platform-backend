-- CreateEnum
CREATE TYPE "AIExplorationStatus" AS ENUM ('DRAFT', 'PROCESSING', 'GENERATED', 'VALIDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AISuggestionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AISuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONVERTED');

-- AlterTable
ALTER TABLE "Bug" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "IterationItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "IterationItemStep" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestCampaign" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "aiSuggestionId" TEXT,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestIteration" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestStep" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestSuite" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AIExploration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "context" TEXT,
    "status" "AIExplorationStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIExploration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITestSuggestion" (
    "id" TEXT NOT NULL,
    "explorationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "expectedResult" TEXT,
    "priority" "AISuggestionPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "AISuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITestSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIExploration_projectId_idx" ON "AIExploration"("projectId");

-- CreateIndex
CREATE INDEX "AIExploration_createdById_idx" ON "AIExploration"("createdById");

-- CreateIndex
CREATE INDEX "AIExploration_status_idx" ON "AIExploration"("status");

-- CreateIndex
CREATE INDEX "AIExploration_createdAt_idx" ON "AIExploration"("createdAt");

-- CreateIndex
CREATE INDEX "AITestSuggestion_explorationId_idx" ON "AITestSuggestion"("explorationId");

-- CreateIndex
CREATE INDEX "AITestSuggestion_priority_idx" ON "AITestSuggestion"("priority");

-- CreateIndex
CREATE INDEX "AITestSuggestion_status_idx" ON "AITestSuggestion"("status");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "TestCase_aiSuggestionId_idx" ON "TestCase"("aiSuggestionId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_aiSuggestionId_fkey" FOREIGN KEY ("aiSuggestionId") REFERENCES "AITestSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExploration" ADD CONSTRAINT "AIExploration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIExploration" ADD CONSTRAINT "AIExploration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITestSuggestion" ADD CONSTRAINT "AITestSuggestion_explorationId_fkey" FOREIGN KEY ("explorationId") REFERENCES "AIExploration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
