import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RunsService {
  constructor(private prisma: PrismaService) {}

  async createRunFromSuite(suiteId: string, name: string) {
    // 1) récupérer la suite + ses items (ordre) + testcaseId
    const suite = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: { items: { orderBy: { order: 'asc' } } },
    });
    if (!suite) throw new NotFoundException('Suite not found');

    // 2) créer le run + cloner les items
    return this.prisma.testRun.create({
      data: {
        suiteId,
        name,
        items: {
          create: suite.items.map((it) => ({
            testCaseId: it.testCaseId,
            status: 'TODO',
          })),
        },
      },
      include: {
        items: {
          include: { testCase: true },
        },
      },
    });
  }

  listRunsBySuite(suiteId: string) {
    return this.prisma.testRun.findMany({
      where: { suiteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  getRun(runId: string) {
    return this.prisma.testRun.findUnique({
      where: { id: runId },
      include: {
        suite: true,
        items: {
          include: { testCase: true },
          orderBy: { testCaseId: 'asc' },
        },
      },
    });
  }

  updateRunItem(
    itemId: string,
    data: { status?: unknown; comment?: string; duration?: number },
  ) {
    return this.prisma.runItem.update({
      where: { id: itemId },
      data: {
         
        status: data.status,
        comment: data.comment,
        duration: data.duration,
      },
      include: { testCase: true },
    });
  }
  //stats run
  async getRunStats(runId: string) {
    const items = await this.prisma.runItem.findMany({
      where: { runId },
      select: { status: true },
    });

    const total = items.length;

    const passed = items.filter((i) => i.status === 'PASSED').length;
    const failed = items.filter((i) => i.status === 'FAILED').length;
    const blocked = items.filter((i) => i.status === 'BLOCKED').length;
    const skipped = items.filter((i) => i.status === 'SKIPPED').length;
    const todo = items.filter((i) => i.status === 'TODO').length;

    const passRate = total === 0 ? 0 : Math.round((passed / total) * 100);

    return { total, passed, failed, blocked, skipped, todo, passRate };
  }
}
