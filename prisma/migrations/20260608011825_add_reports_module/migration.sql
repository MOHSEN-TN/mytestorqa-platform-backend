-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('EXECUTION_SUMMARY', 'COVERAGE', 'TRENDS', 'BUG_REPORT', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('HTML', 'PDF', 'EXCEL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATED', 'SCHEDULED', 'GENERATING', 'FAILED');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATED',
    "period" TEXT,
    "size" TEXT,
    "fileUrl" TEXT,
    "includeCharts" BOOLEAN NOT NULL DEFAULT true,
    "includeDetails" BOOLEAN NOT NULL DEFAULT true,
    "includeLogs" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_projectId_idx" ON "Report"("projectId");

-- CreateIndex
CREATE INDEX "Report_createdById_idx" ON "Report"("createdById");

-- CreateIndex
CREATE INDEX "Report_type_idx" ON "Report"("type");

-- CreateIndex
CREATE INDEX "Report_format_idx" ON "Report"("format");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
