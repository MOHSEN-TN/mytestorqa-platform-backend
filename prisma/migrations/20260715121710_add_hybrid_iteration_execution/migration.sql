-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "IterationExecutionStatus" AS ENUM ('DRAFT', 'RUNNING', 'AWAITING_MANUAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ExecutionStatus" ADD VALUE 'RUNNING';

-- AlterTable
ALTER TABLE "IterationItem" ADD COLUMN     "artifactsZipUrl" TEXT,
ADD COLUMN     "automationCodeSnapshot" TEXT,
ADD COLUMN     "automationFrameworkSnapshot" "AutomationFramework",
ADD COLUMN     "automationLogs" JSONB,
ADD COLUMN     "automationRunId" TEXT,
ADD COLUMN     "browser" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "executionMode" TEXT,
ADD COLUMN     "executionReportUrl" TEXT,
ADD COLUMN     "executionType" "ExecutionType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "failureDetails" JSONB,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "screenshotUrl" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "traceUrl" TEXT;

-- AlterTable
ALTER TABLE "TestIteration" ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "IterationExecutionStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "IterationItem_executionType_idx" ON "IterationItem"("executionType");

-- CreateIndex
CREATE INDEX "IterationItem_automationRunId_idx" ON "IterationItem"("automationRunId");

-- CreateIndex
CREATE INDEX "TestIteration_status_idx" ON "TestIteration"("status");
