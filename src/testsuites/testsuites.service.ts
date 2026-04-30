import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestsuitesService {
  constructor(private prisma: PrismaService) {}

  create(
    projectId: string,
    data: { name: string; description?: string },
  ) {
    return this.prisma.testSuite.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
      },
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
        testCases: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!suite) {
      throw new NotFoundException('Suite not found');
    }

    return suite;
  }

  async update(
    suiteId: string,
    data: { name?: string; description?: string },
  ) {
    const existing = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
    });

    if (!existing) {
      throw new NotFoundException('Suite not found');
    }

    return this.prisma.testSuite.update({
      where: { id: suiteId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async remove(suiteId: string) {
    const existing = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
    });

    if (!existing) {
      throw new NotFoundException('Suite not found');
    }

    return this.prisma.testSuite.delete({
      where: { id: suiteId },
    });
  }

  async duplicate(suiteId: string) {
    const existing = await this.prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: {
        testCases: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Suite not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const newSuite = await tx.testSuite.create({
        data: {
          projectId: existing.projectId,
          name: `${existing.name}-copie`,
          description: existing.description,
        },
      });

      for (const testCase of existing.testCases) {
        await tx.testCase.create({
          data: {
            suiteId: newSuite.id,
            title: `${testCase.title}-copie`,
            description: testCase.description,
            expected: testCase.expected,
            status: testCase.status,
            priority: testCase.priority,
            steps: testCase.steps.length
              ? {
                  create: testCase.steps.map((step, index) => ({
                    stepOrder: index + 1,
                    action: step.action,
                    expected: step.expected,
                  })),
                }
              : undefined,
          },
        });
      }

      return tx.testSuite.findUnique({
        where: { id: newSuite.id },
        include: {
          testCases: {
            include: {
              steps: {
                orderBy: { stepOrder: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });
  }
}