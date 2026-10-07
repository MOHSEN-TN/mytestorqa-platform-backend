import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private readonly projectSelect = {
    id: true,
    name: true,
    description: true,
    baseUrl: true,
    createdAt: true,
    updatedAt: true,
    members: {
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    },
  } as const;

  async listProjects(
    userId: string,
    name?: string,
    pagination: { page: number; limit: number } = { page: 1, limit: 10 },
    userRole?: string,
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.max(1, Math.min(100, pagination.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      ...(userRole === 'ADMIN'
        ? {}
        : { members: { some: { userId } } }),
      ...(name?.trim()
        ? { name: { contains: name.trim(), mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: this.projectSelect,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createProject(
    userId: string,
    name: string,
    description?: string | null,
    baseUrl?: string | null,
  ) {
    return this.prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        baseUrl: baseUrl?.trim() || null,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      select: this.projectSelect,
    });
  }

  async updateProject(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      baseUrl?: string | null;
    },
  ) {
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
        ...(data.baseUrl !== undefined && {
          baseUrl: data.baseUrl?.trim() || null,
        }),
      },
      select: this.projectSelect,
    });
  }

  async deleteProject(
    id: string,
    currentUser: { userId: string; role: string },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        members: {
          where: { userId: currentUser.userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isAdmin = currentUser.role === 'ADMIN';
    const isOwner = project.members.some((member) => member.role === 'OWNER');

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Seul un administrateur ou le propriétaire du projet peut le supprimer.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      /*
       * La base historique peut contenir des FK créées sans les actions
       * ON DELETE attendues par le schema Prisma actuel. On nettoie donc
       * explicitement les dépendances, dans un ordre sûr, au lieu de
       * dépendre uniquement des cascades de la base.
       */
      const [suites, campaigns, explorations] = await Promise.all([
        tx.testSuite.findMany({
          where: { projectId: id },
          select: { id: true },
        }),
        tx.testCampaign.findMany({
          where: { projectId: id },
          select: { id: true },
        }),
        tx.aIExploration.findMany({
          where: { projectId: id },
          select: { id: true },
        }),
      ]);

      const suiteIds = suites.map((suite) => suite.id);
      const campaignIds = campaigns.map((campaign) => campaign.id);
      const explorationIds = explorations.map((exploration) => exploration.id);

      const [testCases, iterations, suggestions] = await Promise.all([
        suiteIds.length
          ? tx.testCase.findMany({
              where: { suiteId: { in: suiteIds } },
              select: { id: true },
            })
          : Promise.resolve([] as Array<{ id: string }>),
        campaignIds.length
          ? tx.testIteration.findMany({
              where: { campaignId: { in: campaignIds } },
              select: { id: true },
            })
          : Promise.resolve([] as Array<{ id: string }>),
        explorationIds.length
          ? tx.aITestSuggestion.findMany({
              where: { explorationId: { in: explorationIds } },
              select: { id: true },
            })
          : Promise.resolve([] as Array<{ id: string }>),
      ]);

      const testCaseIds = testCases.map((testCase) => testCase.id);
      const iterationIds = iterations.map((iteration) => iteration.id);
      const suggestionIds = suggestions.map((suggestion) => suggestion.id);

      const [iterationItems, testSteps] = await Promise.all([
        iterationIds.length
          ? tx.iterationItem.findMany({
              where: { iterationId: { in: iterationIds } },
              select: { id: true },
            })
          : Promise.resolve([] as Array<{ id: string }>),
        testCaseIds.length
          ? tx.testStep.findMany({
              where: { testCaseId: { in: testCaseIds } },
              select: { id: true },
            })
          : Promise.resolve([] as Array<{ id: string }>),
      ]);

      const iterationItemIds = iterationItems.map((item) => item.id);
      const testStepIds = testSteps.map((step) => step.id);

      // Historique conserve : on detache le projet avant suppression.
      await tx.report.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      });
      await tx.bug.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      });
      await tx.aIChatSession.updateMany({
        where: { projectId: id },
        data: { projectId: null },
      });

      // Detache aussi les liens vers les objets qui vont etre supprimes.
      if (iterationItemIds.length) {
        await tx.bug.updateMany({
          where: { executionId: { in: iterationItemIds } },
          data: { executionId: null },
        });
      }

      if (testCaseIds.length) {
        await tx.bug.updateMany({
          where: { testCaseId: { in: testCaseIds } },
          data: { testCaseId: null },
        });
      }

      if (explorationIds.length) {
        await tx.aIChatSession.updateMany({
          where: { explorationId: { in: explorationIds } },
          data: { explorationId: null },
        });
      }

      if (suggestionIds.length) {
        await tx.testCase.updateMany({
          where: { aiSuggestionId: { in: suggestionIds } },
          data: { aiSuggestionId: null },
        });
      }

      // Execution / campagnes / suites : suppression du plus profond au parent.
      if (iterationItemIds.length || testStepIds.length) {
        await tx.iterationItemStep.deleteMany({
          where: {
            OR: [
              ...(iterationItemIds.length
                ? [{ iterationItemId: { in: iterationItemIds } }]
                : []),
              ...(testStepIds.length
                ? [{ testStepId: { in: testStepIds } }]
                : []),
            ],
          },
        });
      }

      if (iterationItemIds.length) {
        await tx.iterationItem.deleteMany({
          where: { id: { in: iterationItemIds } },
        });
      }

      if (iterationIds.length || suiteIds.length) {
        await tx.iterationSuite.deleteMany({
          where: {
            OR: [
              ...(iterationIds.length
                ? [{ iterationId: { in: iterationIds } }]
                : []),
              ...(suiteIds.length ? [{ suiteId: { in: suiteIds } }] : []),
            ],
          },
        });
      }

      if (iterationIds.length) {
        await tx.testIteration.deleteMany({
          where: { id: { in: iterationIds } },
        });
      }

      if (campaignIds.length) {
        await tx.testCampaign.deleteMany({
          where: { id: { in: campaignIds } },
        });
      }

      if (testStepIds.length) {
        await tx.testStep.deleteMany({
          where: { id: { in: testStepIds } },
        });
      }

      if (testCaseIds.length) {
        await tx.testCase.deleteMany({
          where: { id: { in: testCaseIds } },
        });
      }

      if (suiteIds.length) {
        await tx.testSuite.deleteMany({
          where: { id: { in: suiteIds } },
        });
      }

      // IA : les chats sont conserves, les explorations du projet sont supprimees.
      if (suggestionIds.length) {
        await tx.aITestSuggestion.deleteMany({
          where: { id: { in: suggestionIds } },
        });
      }

      if (explorationIds.length) {
        await tx.aIExploration.deleteMany({
          where: { id: { in: explorationIds } },
        });
      }

      await tx.lighthouseAudit.deleteMany({
        where: { projectId: id },
      });

      await tx.projectMember.deleteMany({
        where: { projectId: id },
      });

      return tx.project.delete({
        where: { id },
      });
    });
  }

  async addMember(
    projectId: string,
    userId: string,
    role: 'OWNER' | 'QA_LEAD' | 'TESTER' = 'TESTER',
  ) {
    return this.prisma.projectMember.create({
      data: { projectId, userId, role },
    });
  }

  async duplicate(projectId: string, userId: string) {
    const existing = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        members: { some: { userId } },
      },
      include: {
        testSuites: {
          include: {
            testCases: {
              include: {
                steps: { orderBy: { stepOrder: 'asc' } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: `${existing.name}-copie`,
          description: existing.description,
          baseUrl: existing.baseUrl,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });

      for (const suite of existing.testSuites) {
        const newSuite = await tx.testSuite.create({
          data: {
            projectId: newProject.id,
            name: `${suite.name}-copie`,
            description: suite.description,
          },
        });

        for (const testCase of suite.testCases) {
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
      }

      return tx.project.findUnique({
        where: { id: newProject.id },
        select: this.projectSelect,
      });
    });
  }
}
