-- CreateTable
CREATE TABLE "LighthouseAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "qualityScore" INTEGER,
    "performance" INTEGER,
    "accessibility" INTEGER,
    "bestPractices" INTEGER,
    "seo" INTEGER,
    "lighthouseVersion" TEXT,
    "durationMs" INTEGER,
    "auditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LighthouseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LighthouseAudit_projectId_idx" ON "LighthouseAudit"("projectId");

-- CreateIndex
CREATE INDEX "LighthouseAudit_auditedAt_idx" ON "LighthouseAudit"("auditedAt");

-- AddForeignKey
ALTER TABLE "LighthouseAudit" ADD CONSTRAINT "LighthouseAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
