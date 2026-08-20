import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestsuitesService {
  constructor(private prisma: PrismaService) {}

  private handlePrismaDuplicateError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }

  async create(
    projectId: string,
    data: { name: string; description?: string },
  ) {
    try {
      return await this.prisma.testSuite.create({
        data: {
          projectId,
          name: data.name,
          description: data.description,
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Une suite avec ce nom existe déjà dans ce projet.',
      );
    }
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

    try {
      return await this.prisma.testSuite.update({
        where: { id: suiteId },
        data: {
          name: data.name,
          description: data.description,
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Une suite avec ce nom existe déjà dans ce projet.',
      );
    }
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

    const copiedSuiteName = `${existing.name}-copie`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const newSuite = await tx.testSuite.create({
          data: {
            projectId: existing.projectId,
            name: copiedSuiteName,
            description: existing.description,
          },
        });

        for (const testCase of existing.testCases) {
          await tx.testCase.create({
            data: {
              suiteId: newSuite.id,
              title: testCase.title,
              description: testCase.description,
              expected: testCase.expected,
              status: testCase.status,
              priority: testCase.priority,

              sourceType: testCase.sourceType,
              generationMode: testCase.generationMode,
              automationFramework: testCase.automationFramework,
              automationCode: testCase.automationCode,
              aiSuggestionId: testCase.aiSuggestionId,

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
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Impossible de dupliquer cette suite : une suite avec ce nom existe déjà dans ce projet.',
      );
    }
  }
}