import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestsuitesService {
  constructor(private prisma: PrismaService) {}

  create(projectId: string, name: string) {
    return this.prisma.testSuite.create({
      data: { projectId, name },
    });
  }

  findAll(projectId: string) {
    return this.prisma.testSuite.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(suiteId: string) {
    const suite = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { testCase: true },
        },
      },
    });
    if (!suite) throw new NotFoundException('Suite not found');
    return suite;
  }

  async addItem(suiteId: string, testCaseId: string) {
    // 1) trouver le dernier ordre actuel
    const last = await this.prisma.suiteItem.findFirst({
      where: { suiteId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = (last?.order ?? 0) + 1;

    // 2) créer le lien suite <-> testcase
    return this.prisma.suiteItem.create({
      data: {
        suiteId,
        testCaseId,
        order: nextOrder,
      },
    });
  }
}
