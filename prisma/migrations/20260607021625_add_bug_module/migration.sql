-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "Bug" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "steps" TEXT,
    "status" "BugStatus" NOT NULL DEFAULT 'NEW',
    "severity" "BugSeverity" NOT NULL DEFAULT 'MAJOR',
    "priority" "BugPriority" NOT NULL DEFAULT 'MEDIUM',
    "projectId" TEXT,
    "testCaseId" TEXT,
    "executionId" TEXT,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bug_projectId_idx" ON "Bug"("projectId");

-- CreateIndex
CREATE INDEX "Bug_testCaseId_idx" ON "Bug"("testCaseId");

-- CreateIndex
CREATE INDEX "Bug_executionId_idx" ON "Bug"("executionId");

-- CreateIndex
CREATE INDEX "Bug_reporterId_idx" ON "Bug"("reporterId");

-- CreateIndex
CREATE INDEX "Bug_assigneeId_idx" ON "Bug"("assigneeId");

-- CreateIndex
CREATE INDEX "Bug_status_idx" ON "Bug"("status");

-- CreateIndex
CREATE INDEX "Bug_severity_idx" ON "Bug"("severity");

-- CreateIndex
CREATE INDEX "Bug_priority_idx" ON "Bug"("priority");

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "IterationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
