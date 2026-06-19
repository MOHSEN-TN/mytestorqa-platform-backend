-- CreateTable
CREATE TABLE "IterationItemStep" (
    "id" TEXT NOT NULL,
    "iterationItemId" TEXT NOT NULL,
    "testStepId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'TODO',
    "comment" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IterationItemStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IterationItemStep_iterationItemId_idx" ON "IterationItemStep"("iterationItemId");

-- CreateIndex
CREATE INDEX "IterationItemStep_testStepId_idx" ON "IterationItemStep"("testStepId");

-- CreateIndex
CREATE INDEX "IterationItemStep_status_idx" ON "IterationItemStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IterationItemStep_iterationItemId_testStepId_key" ON "IterationItemStep"("iterationItemId", "testStepId");

-- AddForeignKey
ALTER TABLE "IterationItemStep" ADD CONSTRAINT "IterationItemStep_iterationItemId_fkey" FOREIGN KEY ("iterationItemId") REFERENCES "IterationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IterationItemStep" ADD CONSTRAINT "IterationItemStep_testStepId_fkey" FOREIGN KEY ("testStepId") REFERENCES "TestStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
