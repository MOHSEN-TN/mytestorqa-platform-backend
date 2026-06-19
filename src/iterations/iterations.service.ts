import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ExecutionStatus } from '@prisma/client';
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
        items: {
          include: {
            testCase: true,
            stepResults: true,
          },
        },
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
            stepResults: {
              include: {
                testStep: true,
              },
              orderBy: {
                testStep: {
                  stepOrder: 'asc',
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
                testCases: {
                  include: {
                    steps: {
                      orderBy: { stepOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!iteration) {
      throw new NotFoundException('Iteration not found');
    }

    const itemsToCreate = iteration.suites.flatMap((iterationSuite) =>
      iterationSuite.suite.testCases.map((testCase) => ({
        iterationId,
        testCaseId: testCase.id,
      })),
    );

    if (itemsToCreate.length === 0) {
      return {
        count: 0,
        message:
          'Aucun test case à générer. Ajoute des suites à cette itération.',
      };
    }

    await this.prisma.iterationItem.createMany({
      data: itemsToCreate,
      skipDuplicates: true,
    });

    const iterationItems = await this.prisma.iterationItem.findMany({
      where: { iterationId },
      include: {
        testCase: {
          include: {
            steps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
      },
    });

    const stepResultsToCreate = iterationItems.flatMap((item) =>
      item.testCase.steps.map((step) => ({
        iterationItemId: item.id,
        testStepId: step.id,
        status: ExecutionStatus.TODO,
      })),
    );

    if (stepResultsToCreate.length > 0) {
      await this.prisma.iterationItemStep.createMany({
        data: stepResultsToCreate,
        skipDuplicates: true,
      });
    }

    return {
      count: itemsToCreate.length,
      message: 'Cas de test et steps générés avec succès.',
    };
  }

  async getRunItems(iterationId: string) {
    const iteration = await this.prisma.testIteration.findUnique({
      where: { id: iterationId },
      include: {
        campaign: {
          include: {
            project: true,
          },
        },
        items: {
          include: {
            testCase: {
              include: {
                suite: true,
                steps: {
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
            stepResults: {
              include: {
                testStep: true,
              },
              orderBy: {
                testStep: {
                  stepOrder: 'asc',
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

    for (const item of iteration.items) {
      const missingStepResults = item.testCase.steps
        .filter(
          (step) =>
            !item.stepResults.some(
              (stepResult) => stepResult.testStepId === step.id,
            ),
        )
        .map((step) => ({
          iterationItemId: item.id,
          testStepId: step.id,
          status: ExecutionStatus.TODO,
        }));

      if (missingStepResults.length > 0) {
        await this.prisma.iterationItemStep.createMany({
          data: missingStepResults,
          skipDuplicates: true,
        });
      }
    }

    return this.prisma.testIteration.findUnique({
      where: { id: iterationId },
      include: {
        campaign: {
          include: {
            project: true,
          },
        },
        items: {
          include: {
            testCase: {
              include: {
                suite: true,
                steps: {
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
            stepResults: {
              include: {
                testStep: true,
              },
              orderBy: {
                testStep: {
                  stepOrder: 'asc',
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async updateStepStatus(
    iterationItemId: string,
    testStepId: string,
    data: {
      status: ExecutionStatus;
      comment?: string;
    },
  ) {
    const item = await this.prisma.iterationItem.findUnique({
      where: { id: iterationItemId },
      include: {
        testCase: {
          include: {
            steps: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Execution item not found');
    }

    const stepBelongsToTestCase = item.testCase.steps.some(
      (step) => step.id === testStepId,
    );

    if (!stepBelongsToTestCase) {
      throw new BadRequestException(
        "Ce step n'appartient pas au cas de test exécuté.",
      );
    }

    await this.prisma.iterationItemStep.upsert({
      where: {
        iterationItemId_testStepId: {
          iterationItemId,
          testStepId,
        },
      },
      update: {
        status: data.status,
        comment: data.comment,
        executedAt: new Date(),
      },
      create: {
        iterationItemId,
        testStepId,
        status: data.status,
        comment: data.comment,
        executedAt: new Date(),
      },
    });

    await this.ensureAllStepResultsExist(iterationItemId);

    const stepResults = await this.prisma.iterationItemStep.findMany({
      where: { iterationItemId },
      select: {
        status: true,
      },
    });

    const globalStatus = this.calculateItemStatus(
      stepResults.map((stepResult) => stepResult.status),
    );

    await this.prisma.iterationItem.update({
      where: { id: iterationItemId },
      data: {
        status: globalStatus,
        executedAt:
          globalStatus === ExecutionStatus.TODO ? null : new Date(),
      },
    });

    return this.prisma.iterationItem.findUnique({
      where: { id: iterationItemId },
      include: {
        testCase: {
          include: {
            suite: true,
            steps: {
              orderBy: { stepOrder: 'asc' },
            },
          },
        },
        stepResults: {
          include: {
            testStep: true,
          },
          orderBy: {
            testStep: {
              stepOrder: 'asc',
            },
          },
        },
      },
    });
  }

  private async ensureAllStepResultsExist(iterationItemId: string) {
    const item = await this.prisma.iterationItem.findUnique({
      where: { id: iterationItemId },
      include: {
        testCase: {
          include: {
            steps: true,
          },
        },
        stepResults: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Execution item not found');
    }

    const missingStepResults = item.testCase.steps
      .filter(
        (step) =>
          !item.stepResults.some(
            (stepResult) => stepResult.testStepId === step.id,
          ),
      )
      .map((step) => ({
        iterationItemId,
        testStepId: step.id,
        status: ExecutionStatus.TODO,
      }));

    if (missingStepResults.length > 0) {
      await this.prisma.iterationItemStep.createMany({
        data: missingStepResults,
        skipDuplicates: true,
      });
    }
  }

  private calculateItemStatus(
    stepStatuses: ExecutionStatus[],
  ): ExecutionStatus {
    if (stepStatuses.length === 0) {
      return ExecutionStatus.TODO;
    }

    if (stepStatuses.includes(ExecutionStatus.FAILED)) {
      return ExecutionStatus.FAILED;
    }

    if (stepStatuses.includes(ExecutionStatus.BLOCKED)) {
      return ExecutionStatus.BLOCKED;
    }

    if (stepStatuses.every((status) => status === ExecutionStatus.SUCCESS)) {
      return ExecutionStatus.SUCCESS;
    }

    if (stepStatuses.every((status) => status === ExecutionStatus.SKIPPED)) {
      return ExecutionStatus.SKIPPED;
    }

    return ExecutionStatus.TODO;
  }
}