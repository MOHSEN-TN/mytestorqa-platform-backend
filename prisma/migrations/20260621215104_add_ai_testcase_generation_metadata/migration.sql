-- CreateEnum
CREATE TYPE "TestCaseSourceType" AS ENUM ('MANUAL', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "AIGenerationMode" AS ENUM ('RULE_BASED', 'OLLAMA_LOCAL', 'CLOUD_AI');

-- CreateEnum
CREATE TYPE "AutomationFramework" AS ENUM ('PLAYWRIGHT', 'SELENIUM', 'CYPRESS');

-- AlterTable
ALTER TABLE "AIExploration" ADD COLUMN     "generationMode" "AIGenerationMode" NOT NULL DEFAULT 'RULE_BASED';

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "automationCode" TEXT,
ADD COLUMN     "automationFramework" "AutomationFramework",
ADD COLUMN     "generationMode" "AIGenerationMode",
ADD COLUMN     "sourceType" "TestCaseSourceType" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "AIExploration_generationMode_idx" ON "AIExploration"("generationMode");

-- CreateIndex
CREATE INDEX "TestCase_sourceType_idx" ON "TestCase"("sourceType");

-- CreateIndex
CREATE INDEX "TestCase_generationMode_idx" ON "TestCase"("generationMode");

-- CreateIndex
CREATE INDEX "TestCase_automationFramework_idx" ON "TestCase"("automationFramework");
