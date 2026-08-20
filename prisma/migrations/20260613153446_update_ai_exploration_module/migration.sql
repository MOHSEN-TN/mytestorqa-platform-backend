-- AlterTable
ALTER TABLE "AIExploration" ADD COLUMN     "authenticationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "generateGherkin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "generateNegativeTests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "generatePlaywright" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "targetUrl" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE INDEX "AIExploration_targetUrl_idx" ON "AIExploration"("targetUrl");
