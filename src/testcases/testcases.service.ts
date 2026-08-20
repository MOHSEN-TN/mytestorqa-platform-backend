/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TestCaseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTestCaseDto,
  GetAllTestCasesBySuitesDTO,
  UpdateTestCaseDto,
} from './dto/testcase.dto';
import {
  PlaywrightRunnerService,
  PlaywrightRunOptions,
} from './automation/playwright-runner.service';

@Injectable()
export class TestcasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playwrightRunnerService: PlaywrightRunnerService,
  ) {}

  private handlePrismaDuplicateError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }

  async create(suiteId: string, data: CreateTestCaseDto) {
    try {
      return await this.prisma.testCase.create({
        data: {
          suiteId,
          title: data.title,
          description: data.description,
          expected: data.expected,
          status: data.status ?? 'DRAFT',
          priority: data.priority ?? 'MEDIUM',

          automationFramework: data.automationFramework ?? null,
          automationCode: data.automationCode ?? null,

          steps: data.steps?.length
            ? {
                create: data.steps.map((step, index) => ({
                  stepOrder: index + 1,
                  action: step.action,
                  expected: step.expected,
                })),
              }
            : undefined,
        },
        include: {
          suite: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Un cas de test avec ce titre existe déjà dans cette suite.',
      );
    }
  }

  async findAll(
    suiteId: string,
    data: GetAllTestCasesBySuitesDTO,
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    const where: any = { suiteId };

    if (data.status && data.status !== 'ALL') {
      where.status = data.status as TestCaseStatus;
    }

    if (data.priority && data.priority !== 'ALL') {
      where.priority = data.priority;
    }

    if (data.search && data.search.trim()) {
      where.OR = [
        { title: { contains: data.search, mode: 'insensitive' } },
        { description: { contains: data.search, mode: 'insensitive' } },
      ];
    }

    const page = data.page ?? 1;
    const limit = data.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.testCase.findMany({
        where,
        include: {
          suite: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.testCase.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(suiteId: string, testCaseId: string) {
    const testCase = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
      include: {
        suite: true,
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!testCase) {
      throw new NotFoundException('TestCase not found');
    }

    return testCase;
  }

  async update(suiteId: string, testCaseId: string, data: UpdateTestCaseDto) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    try {
      return await this.prisma.testCase.update({
        where: { id: testCaseId },
        data: {
          title: data.title,
          description: data.description,
          expected: data.expected,
          status: data.status,
          priority: data.priority,

          ...(data.automationFramework !== undefined && {
            automationFramework: data.automationFramework || null,
          }),

          ...(data.automationCode !== undefined && {
            automationCode: data.automationCode || null,
          }),

          steps: data.steps
            ? {
                deleteMany: {},
                create: data.steps.map((step, index) => ({
                  stepOrder: index + 1,
                  action: step.action,
                  expected: step.expected,
                })),
              }
            : undefined,
        },
        include: {
          suite: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Un cas de test avec ce titre existe déjà dans cette suite.',
      );
    }
  }

  async move(suiteId: string, testCaseId: string, targetSuiteId: string) {
    if (!targetSuiteId) {
      throw new BadRequestException('targetSuiteId is required');
    }

    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
      include: {
        suite: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    const targetSuite = await this.prisma.testSuite.findUnique({
      where: {
        id: targetSuiteId,
      },
    });

    if (!targetSuite) {
      throw new NotFoundException('Target suite not found');
    }

    if (existing.suite.projectId !== targetSuite.projectId) {
      throw new BadRequestException(
        'Cannot move a test case to a suite from another project',
      );
    }

    try {
      return await this.prisma.testCase.update({
        where: {
          id: testCaseId,
        },
        data: {
          suiteId: targetSuiteId,
        },
        include: {
          suite: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Impossible de déplacer ce cas : la suite destination contient déjà un cas de test avec le même titre.',
      );
    }
  }

  async runAutomation(
    suiteId: string,
    testCaseId: string,
    options: PlaywrightRunOptions = {},
  ) {
    const testCase = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
    });

    if (!testCase) {
      throw new NotFoundException('TestCase not found');
    }

    if (testCase.automationFramework !== 'PLAYWRIGHT') {
      throw new BadRequestException(
        'This test case is not configured for Playwright automation',
      );
    }

    if (!testCase.automationCode?.trim()) {
      throw new BadRequestException(
        'This test case does not contain Playwright automation code',
      );
    }

    const headed = options.headed ?? false;

    const slowMo = headed
      ? Math.min(Math.max(options.slowMo ?? 500, 0), 3000)
      : undefined;

    return this.playwrightRunnerService.runCode(
      testCase.automationCode,
      testCase.id,
      {
        headed,
        slowMo,
      },
    );
  }

  async remove(suiteId: string, testCaseId: string) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    return this.prisma.testCase.delete({
      where: { id: testCaseId },
    });
  }

  async duplicate(suiteId: string, testCaseId: string) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    const copiedTitle = `${existing.title}-copie`;

    try {
      return await this.prisma.testCase.create({
        data: {
          suiteId: existing.suiteId,
          title: copiedTitle,
          description: existing.description,
          expected: existing.expected,
          status: existing.status,
          priority: existing.priority,

          sourceType: existing.sourceType,
          generationMode: existing.generationMode,
          automationFramework: existing.automationFramework,
          automationCode: existing.automationCode,
          aiSuggestionId: existing.aiSuggestionId,

          steps: existing.steps.length
            ? {
                create: existing.steps.map((step, index) => ({
                  stepOrder: index + 1,
                  action: step.action,
                  expected: step.expected,
                })),
              }
            : undefined,
        },
        include: {
          suite: true,
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
        },
      });
    } catch (error) {
      this.handlePrismaDuplicateError(
        error,
        'Impossible de dupliquer ce cas : un cas de test avec ce titre existe déjà dans cette suite.',
      );
    }
  }
}
