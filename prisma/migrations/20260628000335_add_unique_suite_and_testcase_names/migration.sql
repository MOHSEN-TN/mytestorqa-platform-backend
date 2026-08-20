/*
  Warnings:

  - A unique constraint covering the columns `[suiteId,title]` on the table `TestCase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,name]` on the table `TestSuite` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TestCase_suiteId_title_key" ON "TestCase"("suiteId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "TestSuite_projectId_name_key" ON "TestSuite"("projectId", "name");
