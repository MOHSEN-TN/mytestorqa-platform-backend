/*
  Warnings:

  - A unique constraint covering the columns `[projectId]` on the table `LighthouseAudit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,name]` on the table `TestCampaign` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campaignId,name]` on the table `TestIteration` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LighthouseAudit_projectId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "LighthouseAudit_projectId_key" ON "LighthouseAudit"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCampaign_projectId_name_key" ON "TestCampaign"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TestIteration_campaignId_name_key" ON "TestIteration"("campaignId", "name");
