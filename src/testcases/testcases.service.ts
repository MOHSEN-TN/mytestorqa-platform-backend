/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTestCaseDto,
  GetAllTestCasesBySuitesDTO,
  UpdateTestCaseDto,
} from './dto/testcase.dto';
import { TestCaseStatus } from '@prisma/client';

@Injectable()
export class TestcasesService {
  constructor(private prisma: PrismaService) {}

  create(suiteId: string, data: CreateTestCaseDto) {
    return this.prisma.testCase.create({
      data: {
        suiteId,
        title: data.title,
        description: data.description,
        expected: data.expected,
        status: data.status ?? 'DRAFT',
        priority: data.priority ?? 'MEDIUM',
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
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });
  }

  async findAll(suiteId: string, data: GetAllTestCasesBySuitesDTO): Promise<any[]> {
    const where: any = {
      suiteId,
    };
    
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
    
    return this.prisma.testCase.findMany({
      where,
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(suiteId: string, testCaseId: string) {
    const tc = await this.prisma.testCase.findFirst({
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

    if (!tc) {
      throw new NotFoundException('TestCase not found');
    }

    return tc;
  }

  async update(
    suiteId: string,
    testCaseId: string,
    data: UpdateTestCaseDto,
  ) {
    const existing = await this.prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
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

    return this.prisma.testCase.create({
      data: {
        suiteId: existing.suiteId,
        title: `${existing.title}-copie`,
        description: existing.description,
        expected: existing.expected,
        status: existing.status,
        priority: existing.priority,
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
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });
  }
}