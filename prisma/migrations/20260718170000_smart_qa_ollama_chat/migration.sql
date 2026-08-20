-- Extend the AI exploration lifecycle so a failed Ollama/Playwright run is visible.
ALTER TYPE "AIExplorationStatus" ADD VALUE 'FAILED';

-- Persist the role of each SMART-QA message.
CREATE TYPE "AIChatRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT');

-- Ollama generation metadata and the sanitized Playwright snapshot used by SMART-QA.
ALTER TABLE "AIExploration"
  ADD COLUMN "aiModel" TEXT,
  ADD COLUMN "explorationSnapshot" JSONB,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "generationDurationMs" INTEGER,
  ADD COLUMN "promptTokens" INTEGER,
  ADD COLUMN "completionTokens" INTEGER,
  ADD COLUMN "ollamaTotalDurationMs" INTEGER,
  ADD COLUMN "lastGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "fallbackUsed" BOOLEAN NOT NULL DEFAULT false;

-- Structured output fields returned by Qwen through Ollama.
ALTER TABLE "AITestSuggestion"
  ADD COLUMN "steps" JSONB,
  ADD COLUMN "gherkin" TEXT,
  ADD COLUMN "sourcePageUrl" TEXT,
  ADD COLUMN "aiConfidence" DOUBLE PRECISION;

-- Persistent SMART-QA conversations.
CREATE TABLE "AIChatSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "explorationId" TEXT,
  "title" TEXT NOT NULL DEFAULT 'Nouvelle conversation SMART-QA',
  "model" TEXT NOT NULL DEFAULT 'qwen3.5:9b',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIChatMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "AIChatRole" NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIChatSession_userId_idx" ON "AIChatSession"("userId");
CREATE INDEX "AIChatSession_projectId_idx" ON "AIChatSession"("projectId");
CREATE INDEX "AIChatSession_explorationId_idx" ON "AIChatSession"("explorationId");
CREATE INDEX "AIChatSession_lastMessageAt_idx" ON "AIChatSession"("lastMessageAt");

CREATE INDEX "AIChatMessage_sessionId_idx" ON "AIChatMessage"("sessionId");
CREATE INDEX "AIChatMessage_role_idx" ON "AIChatMessage"("role");
CREATE INDEX "AIChatMessage_createdAt_idx" ON "AIChatMessage"("createdAt");

ALTER TABLE "AIChatSession"
  ADD CONSTRAINT "AIChatSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIChatSession"
  ADD CONSTRAINT "AIChatSession_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIChatSession"
  ADD CONSTRAINT "AIChatSession_explorationId_fkey"
  FOREIGN KEY ("explorationId") REFERENCES "AIExploration"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIChatMessage"
  ADD CONSTRAINT "AIChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AIChatSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
