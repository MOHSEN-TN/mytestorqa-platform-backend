import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTestCaseDto,
  UpdateTestCaseDto,
} from './dto/testcase.dto';

@Injectable()
export class TestcasesService {
  constructor(private prisma: PrismaService) {}

  create(projectId: string, data: CreateTestCaseDto) {
    return this.prisma.testCase.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        expected: data.expected,
        status: data.status ?? 'DRAFT',
        priority: data.priority ?? 'MEDIUM',
        steps: data.steps
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
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });
  }

  findAll(projectId: string) {
    return this.prisma.testCase.findMany({
      where: { projectId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const tc = await this.prisma.testCase.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    if (!tc) {
      throw new NotFoundException('TestCase not found');
    }

    return tc;
  }

  async update(
    projectId: string,
    testCaseId: string,
    data: UpdateTestCaseDto,
  ) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        projectId,
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    return this.prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        title: data.title,
        description: data.description,
        expected: data.expected,
        status: data.status,
        priority: data.priority,
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
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });
  }

  async remove(projectId: string, testCaseId: string) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        projectId,
      },
    });

    if (!existing) {
      throw new NotFoundException('TestCase not found');
    }

    return this.prisma.testCase.delete({
      where: { id: testCaseId },
    });
  }
}