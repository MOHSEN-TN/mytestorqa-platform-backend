import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AutomationFramework,
  ExecutionStatus,
  ExecutionType,
  IterationExecutionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PlaywrightRunnerService } from '../testcases/automation/playwright-runner.service';
import {
  CreateIterationDto,
  UpdateIterationDto,
} from './dto/create-iteration.dto';

@Injectable()
export class IterationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playwrightRunner: PlaywrightRunnerService,
  ) {}

  async create(
    campaignId: string,
    data: CreateIterationDto,
  ) {
    const campaign =
      await this.prisma.testCampaign.findUnique({
        where: {
          id: campaignId,
        },
      });

    if (!campaign) {
      throw new NotFoundException(
        'Campaign not found',
      );
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
      where: {
        campaignId,
      },
      orderBy: {
        createdAt: 'desc',
      },
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
    const iteration =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
        include: {
          campaign: true,
          suites: {
            include: {
              suite: {
                include: {
                  testCases: {
                    include: {
                      steps: {
                        orderBy: {
                          stepOrder: 'asc',
                        },
                      },
                    },
                    orderBy: {
                      createdAt: 'desc',
                    },
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
                    orderBy: {
                      stepOrder: 'asc',
                    },
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
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    if (!iteration) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    return iteration;
  }

  async update(
    iterationId: string,
    data: UpdateIterationDto,
  ) {
    const existing =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    return this.prisma.testIteration.update({
      where: {
        id: iterationId,
      },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async remove(iterationId: string) {
    const existing =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    return this.prisma.testIteration.delete({
      where: {
        id: iterationId,
      },
    });
  }

  async addSuites(
    iterationId: string,
    suiteIds: string[],
  ) {
    const iteration =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
      });

    if (!iteration) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    if (!suiteIds.length) {
      return {
        count: 0,
      };
    }

    return this.prisma.iterationSuite.createMany({
      data: suiteIds.map((suiteId) => ({
        iterationId,
        suiteId,
      })),
      skipDuplicates: true,
    });
  }

  async removeSuite(
    iterationId: string,
    suiteId: string,
  ) {
    return this.prisma.iterationSuite.delete({
      where: {
        iterationId_suiteId: {
          iterationId,
          suiteId,
        },
      },
    });
  }

  /**
   * Prépare les cas de test de l’itération.
   *
   * - PLAYWRIGHT + automationCode => AUTOMATED
   * - tous les autres cas => MANUAL
   * - les steps sont créés uniquement pour les tests manuels
   * - une copie du code automatisé est conservée dans l’IterationItem
   */
  async generateItems(iterationId: string) {
    const iteration =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
        include: {
          suites: {
            include: {
              suite: {
                include: {
                  testCases: {
                    include: {
                      steps: {
                        orderBy: {
                          stepOrder: 'asc',
                        },
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
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    const testCases =
      iteration.suites.flatMap(
        (iterationSuite) =>
          iterationSuite.suite.testCases,
      );

    if (testCases.length === 0) {
      return {
        count: 0,
        manualCount: 0,
        automatedCount: 0,
        message:
          'Aucun test case à générer. Ajoute des suites à cette itération.',
      };
    }

    let manualCount = 0;
    let automatedCount = 0;

    for (const testCase of testCases) {
      const hasAutomationCode =
        Boolean(
          testCase.automationCode?.trim(),
        );

      const isPlaywrightCompatible =
        testCase.automationFramework ===
          AutomationFramework.PLAYWRIGHT ||
        testCase.automationFramework === null;

      const isAutomated =
        hasAutomationCode &&
        isPlaywrightCompatible;

      if (isAutomated) {
        automatedCount += 1;
      } else {
        manualCount += 1;
      }

      await this.prisma.iterationItem.upsert({
        where: {
          iterationId_testCaseId: {
            iterationId,
            testCaseId: testCase.id,
          },
        },
        create: {
          iterationId,
          testCaseId: testCase.id,
          executionType: isAutomated
            ? ExecutionType.AUTOMATED
            : ExecutionType.MANUAL,
          status: ExecutionStatus.TODO,
          automationFrameworkSnapshot:
            isAutomated
              ? AutomationFramework.PLAYWRIGHT
              : null,
          automationCodeSnapshot:
            isAutomated
              ? testCase.automationCode?.trim()
              : null,
        },
        update: {
          executionType: isAutomated
            ? ExecutionType.AUTOMATED
            : ExecutionType.MANUAL,
          automationFrameworkSnapshot:
            isAutomated
              ? AutomationFramework.PLAYWRIGHT
              : null,
          automationCodeSnapshot:
            isAutomated
              ? testCase.automationCode?.trim()
              : null,
        },
      });
    }

    await this.ensureCorrectStepResults(
      iterationId,
    );

    return {
      count: testCases.length,
      manualCount,
      automatedCount,
      message:
        'Cas de test manuels et automatisés préparés avec succès.',
    };
  }

  /**
   * Démarre une campagne hybride.
   *
   * Le frontend reçoit immédiatement la réponse puis interroge
   * GET /iterations/:iterationId/run pour suivre la progression.
   */
  async startRun(iterationId: string) {
    const existing =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    if (
      existing.status ===
      IterationExecutionStatus.RUNNING
    ) {
      throw new BadRequestException(
        'Cette itération est déjà en cours d’exécution.',
      );
    }

    const preparation =
      await this.generateItems(iterationId);

    if (preparation.count === 0) {
      return {
        iterationId,
        status:
          IterationExecutionStatus.DRAFT,
        ...preparation,
      };
    }

    const startedAt = new Date();

    await this.prisma.iterationItem.updateMany({
      where: {
        iterationId,
        executionType:
          ExecutionType.AUTOMATED,
      },
      data: {
        status: ExecutionStatus.TODO,
        comment: null,
        duration: null,
        startedAt: null,
        finishedAt: null,
        executedAt: null,
        automationRunId: null,
        browser: null,
        executionMode: null,
        error: null,
        failureDetails: Prisma.DbNull,
        automationLogs: Prisma.DbNull,
        screenshotUrl: null,
        traceUrl: null,
        artifactsZipUrl: null,
        executionReportUrl: null,
      },
    });

    await this.prisma.testIteration.update({
      where: {
        id: iterationId,
      },
      data: {
        status:
          IterationExecutionStatus.RUNNING,
        startedAt,
        finishedAt: null,
      },
    });

    if (preparation.automatedCount === 0) {
      await this.refreshIterationStatus(
        iterationId,
      );

      return {
        iterationId,
        status:
          IterationExecutionStatus.AWAITING_MANUAL,
        ...preparation,
      };
    }

    setImmediate(() => {
      void this.executeAutomatedItems(
        iterationId,
      ).catch(async (error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error) ??
                'Unknown execution error';

        await this.prisma.testIteration
          .update({
            where: {
              id: iterationId,
            },
            data: {
              status:
                IterationExecutionStatus.FAILED,
              finishedAt: new Date(),
            },
          })
          .catch(() => undefined);

        // Le détail technique reste journalisé côté backend.
        console.error(
          `[IterationsService] Automated run failed for iteration ${iterationId}: ${message}`,
        );
      });
    });

    return {
      iterationId,
      status:
        IterationExecutionStatus.RUNNING,
      ...preparation,
    };
  }

  async getRunItems(iterationId: string) {
    await this.ensureCorrectStepResults(
      iterationId,
    );

    return this.getIterationRunView(
      iterationId,
    );
  }

  async updateStepStatus(
    iterationItemId: string,
    testStepId: string,
    data: {
      status: ExecutionStatus;
      comment?: string;
    },
  ) {
    const item =
      await this.prisma.iterationItem.findUnique({
        where: {
          id: iterationItemId,
        },
        include: {
          testCase: {
            include: {
              steps: true,
            },
          },
        },
      });

    if (!item) {
      throw new NotFoundException(
        'Execution item not found',
      );
    }

    if (
      item.executionType ===
      ExecutionType.AUTOMATED
    ) {
      throw new BadRequestException(
        'Le résultat d’un cas automatisé est contrôlé par Playwright.',
      );
    }

    if (
      data.status === ExecutionStatus.RUNNING
    ) {
      throw new BadRequestException(
        'Le statut RUNNING est réservé aux exécutions automatisées.',
      );
    }

    const stepBelongsToTestCase =
      item.testCase.steps.some(
        (step) => step.id === testStepId,
      );

    if (!stepBelongsToTestCase) {
      throw new BadRequestException(
        "Ce step n'appartient pas au cas de test exécuté.",
      );
    }

    const now = new Date();

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
        executedAt: now,
      },
      create: {
        iterationItemId,
        testStepId,
        status: data.status,
        comment: data.comment,
        executedAt: now,
      },
    });

    await this.ensureAllStepResultsExist(
      iterationItemId,
    );

    const stepResults =
      await this.prisma.iterationItemStep.findMany({
        where: {
          iterationItemId,
        },
        select: {
          status: true,
        },
      });

    const globalStatus =
      this.calculateItemStatus(
        stepResults.map(
          (stepResult) =>
            stepResult.status,
        ),
      );

    const isTerminal =
      this.isTerminalExecutionStatus(
        globalStatus,
      );

    await this.prisma.iterationItem.update({
      where: {
        id: iterationItemId,
      },
      data: {
        status: globalStatus,
        startedAt:
          item.startedAt ?? now,
        finishedAt: isTerminal
          ? now
          : null,
        executedAt:
          globalStatus ===
          ExecutionStatus.TODO
            ? null
            : now,
      },
    });

    await this.refreshIterationStatus(
      item.iterationId,
    );

    return this.prisma.iterationItem.findUnique({
      where: {
        id: iterationItemId,
      },
      include: {
        testCase: {
          include: {
            suite: true,
            steps: {
              orderBy: {
                stepOrder: 'asc',
              },
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

  private async executeAutomatedItems(
    iterationId: string,
  ) {
    const automatedItems =
      await this.prisma.iterationItem.findMany({
        where: {
          iterationId,
          executionType:
            ExecutionType.AUTOMATED,
        },
        include: {
          testCase: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    for (const item of automatedItems) {
      const automationCode =
        item.automationCodeSnapshot?.trim() ||
        item.testCase.automationCode?.trim();

      const startedAt = new Date();

      await this.prisma.iterationItem.update({
        where: {
          id: item.id,
        },
        data: {
          status: ExecutionStatus.RUNNING,
          startedAt,
          finishedAt: null,
          executedAt: null,
          error: null,
        },
      });

      if (!automationCode) {
        const finishedAt = new Date();

        await this.prisma.iterationItem.update({
          where: {
            id: item.id,
          },
          data: {
            status:
              ExecutionStatus.BLOCKED,
            finishedAt,
            executedAt: finishedAt,
            duration:
              finishedAt.getTime() -
              startedAt.getTime(),
            error:
              'Le code Playwright est absent pour ce cas automatisé.',
          },
        });

        continue;
      }

      try {
        const result =
          await this.playwrightRunner.runCode(
            automationCode,
            item.testCaseId,
            {
              headed: false,
              slowMo: 0,
              timeoutMs: 120000,
            },
          );

        const mappedStatus =
          this.mapPlaywrightStatus(
            result.status,
          );

        await this.prisma.iterationItem.update({
          where: {
            id: item.id,
          },
          data: {
            status: mappedStatus,
            duration: result.durationMs,
            startedAt:
              this.parseDateOrFallback(
                result.startedAt,
                startedAt,
              ),
            finishedAt:
              this.parseDateOrFallback(
                result.finishedAt,
                new Date(),
              ),
            executedAt:
              this.parseDateOrFallback(
                result.finishedAt,
                new Date(),
              ),

            automationRunId:
              result.runId,
            browser: result.browser,
            executionMode: result.mode,

            error: result.error,
            failureDetails:
              result.failureDetails
                ? this.toJsonValue(
                    result.failureDetails,
                  )
                : Prisma.DbNull,
            automationLogs:
              this.toJsonValue(
                result.logs,
              ),

            screenshotUrl:
              result.screenshotUrl,
            traceUrl: result.traceUrl,
            artifactsZipUrl:
              result.artifactsZipUrl,
            executionReportUrl:
              result.executionReportUrl,
          },
        });
      } catch (error) {
        const finishedAt = new Date();
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        await this.prisma.iterationItem.update({
          where: {
            id: item.id,
          },
          data: {
            status:
              ExecutionStatus.BLOCKED,
            duration:
              finishedAt.getTime() -
              startedAt.getTime(),
            finishedAt,
            executedAt: finishedAt,
            error: message,
          },
        });
      }
    }

    await this.refreshIterationStatus(
      iterationId,
    );
  }

  private async getIterationRunView(
    iterationId: string,
  ) {
    const iteration =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
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
                    orderBy: {
                      stepOrder: 'asc',
                    },
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
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

    if (!iteration) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    return iteration;
  }

  private async ensureCorrectStepResults(
    iterationId: string,
  ) {
    const items =
      await this.prisma.iterationItem.findMany({
        where: {
          iterationId,
        },
        include: {
          testCase: {
            include: {
              steps: {
                orderBy: {
                  stepOrder: 'asc',
                },
              },
            },
          },
          stepResults: true,
        },
      });

    for (const item of items) {
      if (
        item.executionType ===
        ExecutionType.AUTOMATED
      ) {
        if (item.stepResults.length > 0) {
          await this.prisma.iterationItemStep.deleteMany({
            where: {
              iterationItemId: item.id,
            },
          });
        }

        continue;
      }

      const missingStepResults =
        item.testCase.steps
          .filter(
            (step) =>
              !item.stepResults.some(
                (stepResult) =>
                  stepResult.testStepId ===
                  step.id,
              ),
          )
          .map((step) => ({
            iterationItemId: item.id,
            testStepId: step.id,
            status:
              ExecutionStatus.TODO,
          }));

      if (missingStepResults.length > 0) {
        await this.prisma.iterationItemStep.createMany({
          data: missingStepResults,
          skipDuplicates: true,
        });
      }
    }
  }

  private async ensureAllStepResultsExist(
    iterationItemId: string,
  ) {
    const item =
      await this.prisma.iterationItem.findUnique({
        where: {
          id: iterationItemId,
        },
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
      throw new NotFoundException(
        'Execution item not found',
      );
    }

    if (
      item.executionType ===
      ExecutionType.AUTOMATED
    ) {
      return;
    }

    const missingStepResults =
      item.testCase.steps
        .filter(
          (step) =>
            !item.stepResults.some(
              (stepResult) =>
                stepResult.testStepId ===
                step.id,
            ),
        )
        .map((step) => ({
          iterationItemId,
          testStepId: step.id,
          status:
            ExecutionStatus.TODO,
        }));

    if (missingStepResults.length > 0) {
      await this.prisma.iterationItemStep.createMany({
        data: missingStepResults,
        skipDuplicates: true,
      });
    }
  }

  private async refreshIterationStatus(
    iterationId: string,
  ) {
    const iteration =
      await this.prisma.testIteration.findUnique({
        where: {
          id: iterationId,
        },
        include: {
          items: {
            select: {
              executionType: true,
              status: true,
            },
          },
        },
      });

    if (!iteration) {
      throw new NotFoundException(
        'Iteration not found',
      );
    }

    if (iteration.items.length === 0) {
      return this.prisma.testIteration.update({
        where: {
          id: iterationId,
        },
        data: {
          status:
            IterationExecutionStatus.DRAFT,
          finishedAt: null,
        },
      });
    }

    const hasRunning =
      iteration.items.some(
        (item) =>
          item.status ===
          ExecutionStatus.RUNNING,
      );

    if (hasRunning) {
      return this.prisma.testIteration.update({
        where: {
          id: iterationId,
        },
        data: {
          status:
            IterationExecutionStatus.RUNNING,
          finishedAt: null,
        },
      });
    }

    const hasPendingAutomated =
      iteration.items.some(
        (item) =>
          item.executionType ===
            ExecutionType.AUTOMATED &&
          item.status ===
            ExecutionStatus.TODO,
      );

    if (hasPendingAutomated) {
      return this.prisma.testIteration.update({
        where: {
          id: iterationId,
        },
        data: {
          status:
            IterationExecutionStatus.RUNNING,
          finishedAt: null,
        },
      });
    }

    const hasPendingManual =
      iteration.items.some(
        (item) =>
          item.executionType ===
            ExecutionType.MANUAL &&
          item.status ===
            ExecutionStatus.TODO,
      );

    if (hasPendingManual) {
      return this.prisma.testIteration.update({
        where: {
          id: iterationId,
        },
        data: {
          status:
            IterationExecutionStatus.AWAITING_MANUAL,
          finishedAt: null,
        },
      });
    }

    return this.prisma.testIteration.update({
      where: {
        id: iterationId,
      },
      data: {
        status:
          IterationExecutionStatus.COMPLETED,
        finishedAt: new Date(),
      },
    });
  }

  private calculateItemStatus(
    stepStatuses: ExecutionStatus[],
  ): ExecutionStatus {
    if (stepStatuses.length === 0) {
      return ExecutionStatus.TODO;
    }

    if (
      stepStatuses.includes(
        ExecutionStatus.FAILED,
      )
    ) {
      return ExecutionStatus.FAILED;
    }

    if (
      stepStatuses.includes(
        ExecutionStatus.BLOCKED,
      )
    ) {
      return ExecutionStatus.BLOCKED;
    }

    if (
      stepStatuses.every(
        (status) =>
          status ===
          ExecutionStatus.SUCCESS,
      )
    ) {
      return ExecutionStatus.SUCCESS;
    }

    if (
      stepStatuses.every(
        (status) =>
          status ===
          ExecutionStatus.SKIPPED,
      )
    ) {
      return ExecutionStatus.SKIPPED;
    }

    return ExecutionStatus.TODO;
  }

  private mapPlaywrightStatus(
    status: 'PASSED' | 'FAILED' | 'ERROR',
  ): ExecutionStatus {
    switch (status) {
      case 'PASSED':
        return ExecutionStatus.SUCCESS;
      case 'FAILED':
        return ExecutionStatus.FAILED;
      case 'ERROR':
      default:
        return ExecutionStatus.BLOCKED;
    }
  }

  private isTerminalExecutionStatus(
    status: ExecutionStatus,
  ): boolean {
    switch (status) {
      case ExecutionStatus.SUCCESS:
      case ExecutionStatus.FAILED:
      case ExecutionStatus.BLOCKED:
      case ExecutionStatus.SKIPPED:
        return true;

      case ExecutionStatus.TODO:
      case ExecutionStatus.RUNNING:
      default:
        return false;
    }
  }

  private parseDateOrFallback(
    value: string | null,
    fallback: Date,
  ) {
    if (!value) {
      return fallback;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? fallback
      : parsed;
  }

  private toJsonValue(
    value: unknown,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value),
    ) as Prisma.InputJsonValue;
  }
}
