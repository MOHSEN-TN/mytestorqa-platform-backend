import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateIterationDto,
  UpdateIterationDto,
} from './dto/create-iteration.dto';

@Injectable()
export class IterationsService {
  constructor(private prisma: PrismaService) {}

  async create(campaignId: string, data: CreateIterationDto) {
    const campaign = await this.prisma.testCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.testIteration.create({
      data: {
        campaignId,
        name: data.name,
        description: data.description,
      },
    });
  }

  findAll(campaignId: string) {
    return this.prisma.testIteration.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      include: {
        suites: {
          include: {
            suite: true,
          },
        },
        items: true,
      },
    });
  }

  async findOne(iterationId: string) {
    const iteration = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
      include: {
        campaign: true,
        suites: {
          include: {
            suite: {
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
            },
          },
        },
        items: {
          include: {
            testCase: {
              include: {
                steps: {
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!iteration) {
      throw new NotFoundException('Iteration not found');
    }

    return iteration;
  }

  async update(iterationId: string, data: UpdateIterationDto) {
    const existing = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
    });

    if (!existing) {
      throw new NotFoundException('Iteration not found');
    }

    return this.prisma.testIteration.update({
      where: { id: iterationId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async remove(iterationId: string) {
    const existing = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
    });

    if (!existing) {
      throw new NotFoundException('Iteration not found');
    }

    return this.prisma.testIteration.delete({
      where: { id: iterationId },
    });
  }

  async addSuites(iterationId: string, suiteIds: string[]) {
    const iteration = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
    });

    if (!iteration) {
      throw new NotFoundException('Iteration not found');
    }

    if (!suiteIds.length) {
      return { count: 0 };
    }

    return this.prisma.iterationSuite.createMany({
      data: suiteIds.map((suiteId) => ({
        iterationId,
        suiteId,
      })),
      skipDuplicates: true,
    });
  }

  async removeSuite(iterationId: string, suiteId: string) {
    return this.prisma.iterationSuite.delete({
      where: {
        iterationId_suiteId: {
          iterationId,
          suiteId,
        },
      },
    });
  }

  async generateItems(iterationId: string) {
    const iteration = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
      include: {
        suites: {
          include: {
            suite: {
              include: {
                testCases: true,
              },
            },
          },
        },
      },
    });

    if (!iteration) {
      throw new NotFoundException('Iteration not found');
    }

    const items = iteration.suites.flatMap((iterationSuite) =>
      iterationSuite.suite.testCases.map((testCase) => ({
        iterationId,
        testCaseId: testCase.id,
      })),
    );

    if (items.length === 0) {
      return {
        count: 0,
        message:
          'Aucun test case à générer. Ajoute des suites à cette itération.',
      };
    }

    return this.prisma.iterationItem.createMany({
      data: items,
      skipDuplicates: true,
    });
  }
}