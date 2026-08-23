// src/bugs/bugs.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BugPriority,
  BugSeverity,
  BugStatus,
  Prisma,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateBugDto = {
  title: string;
  description?: string;
  steps?: string;
  severity?: BugSeverity;
  priority?: BugPriority;
  projectId?: string;
  testCaseId?: string;
  iterationId?: string;
  executionId?: string;
  assigneeId?: string;
};

type UpdateBugDto = Partial<Omit<CreateBugDto, 'iterationId'>> & {
  status?: BugStatus;
};

type CurrentUser = {
  userId: string;
  role: RoleType;
};

@Injectable()
export class BugsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    status?: BugStatus | 'ALL' | 'OPEN';
    projectId?: string;
    mine?: boolean;
    userId: string;
  }) {
    const { page, limit, search, status, projectId, mine, userId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BugWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { steps: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'ALL') {
      if (status === 'OPEN') {
        where.status = {
          in: [BugStatus.NEW, BugStatus.IN_PROGRESS, BugStatus.REOPENED],
        };
      } else {
        where.status = status;
      }
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (mine) {
      const existingOr = Array.isArray(where.OR)
        ? where.OR
        : where.OR
          ? [where.OR]
          : [];

      where.OR = [
        ...existingOr,
        { reporterId: userId },
        { assigneeId: userId },
      ];
    }

    const [bugs, total] = await Promise.all([
      this.prisma.bug.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          testCase: {
            select: {
              id: true,
              title: true,
            },
          },
          execution: {
            select: {
              id: true,
              status: true,
            },
          },
          reporter: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.bug.count({ where }),
    ]);

    return {
      data: bugs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(userId?: string) {
    const openStatuses = [
      BugStatus.NEW,
      BugStatus.IN_PROGRESS,
      BugStatus.REOPENED,
    ];

    const [
      total,
      open,
      newBugs,
      inProgress,
      resolved,
      critical,
      mine,
    ] = await Promise.all([
      this.prisma.bug.count(),
      this.prisma.bug.count({
        where: {
          status: {
            in: openStatuses,
          },
        },
      }),
      this.prisma.bug.count({
        where: {
          status: BugStatus.NEW,
        },
      }),
      this.prisma.bug.count({
        where: {
          status: BugStatus.IN_PROGRESS,
        },
      }),
      this.prisma.bug.count({
        where: {
          status: BugStatus.RESOLVED,
        },
      }),
      this.prisma.bug.count({
        where: {
          severity: {
            in: [BugSeverity.CRITICAL, BugSeverity.BLOCKER],
          },
        },
      }),
      userId
        ? this.prisma.bug.count({
            where: {
              OR: [{ reporterId: userId }, { assigneeId: userId }],
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      total,
      open,
      new: newBugs,
      inProgress,
      resolved,
      critical,
      mine,
    };
  }

  async findOne(id: string) {
    const bug = await this.prisma.bug.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        testCase: {
          select: {
            id: true,
            title: true,
          },
        },
        execution: {
          select: {
            id: true,
            status: true,
          },
        },
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!bug) {
      throw new NotFoundException('Bug non trouvé');
    }

    return { data: bug };
  }

  async create(data: CreateBugDto, reporterId: string) {
    if (!data.title || !data.title.trim()) {
      throw new BadRequestException('Le titre du bug est requis');
    }

    if (data.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new BadRequestException('Projet introuvable');
      }
    }

    if (data.testCaseId) {
      const testCase = await this.prisma.testCase.findUnique({
        where: { id: data.testCaseId },
        select: {
          id: true,
          suite: {
            select: {
              projectId: true,
            },
          },
        },
      });

      if (!testCase) {
        throw new BadRequestException('Cas de test introuvable');
      }

      if (data.projectId && testCase.suite.projectId !== data.projectId) {
        throw new BadRequestException(
          'Le cas de test sélectionné n’appartient pas au projet du bug',
        );
      }
    }

    // The UI no longer asks the user to choose an execution explicitly.
    // When both an iteration and a test case are selected, resolve the matching
    // IterationItem automatically and keep Bug.executionId as the technical link.
    let resolvedExecutionId = data.executionId || null;

    if (!resolvedExecutionId && data.iterationId && data.testCaseId) {
      const iteration = await this.prisma.testIteration.findUnique({
        where: { id: data.iterationId },
        select: {
          id: true,
          campaign: {
            select: {
              projectId: true,
            },
          },
        },
      });

      if (!iteration) {
        throw new BadRequestException('Itération introuvable');
      }

      if (data.projectId && iteration.campaign.projectId !== data.projectId) {
        throw new BadRequestException(
          'L’itération sélectionnée n’appartient pas au projet du bug',
        );
      }

      const matchingExecution = await this.prisma.iterationItem.findFirst({
        where: {
          iterationId: data.iterationId,
          testCaseId: data.testCaseId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      resolvedExecutionId = matchingExecution?.id || null;
    }

    if (resolvedExecutionId) {
      const execution = await this.prisma.iterationItem.findUnique({
        where: { id: resolvedExecutionId },
        select: {
          id: true,
          testCaseId: true,
          iteration: {
            select: {
              campaign: {
                select: {
                  projectId: true,
                },
              },
            },
          },
        },
      });

      if (!execution) {
        throw new BadRequestException('Exécution introuvable');
      }

      if (
        data.projectId &&
        execution.iteration.campaign.projectId !== data.projectId
      ) {
        throw new BadRequestException(
          'L’exécution sélectionnée n’appartient pas au projet du bug',
        );
      }

      if (data.testCaseId && execution.testCaseId !== data.testCaseId) {
        throw new BadRequestException(
          'L’exécution sélectionnée ne correspond pas au cas de test choisi',
        );
      }
    }

    if (data.assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: data.assigneeId },
      });

      if (!assignee) {
        throw new BadRequestException('Utilisateur assigné introuvable');
      }
    }

    const bug = await this.prisma.bug.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        steps: data.steps?.trim() || null,
        severity: data.severity || BugSeverity.MAJOR,
        priority: data.priority || BugPriority.MEDIUM,
        projectId: data.projectId || null,
        testCaseId: data.testCaseId || null,
        executionId: resolvedExecutionId,
        assigneeId: data.assigneeId || null,
        reporterId,
      },
      include: {
        project: true,
        testCase: true,
        execution: true,
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      data: bug,
      message: 'Bug créé avec succès',
    };
  }

  async update(
    id: string,
    data: UpdateBugDto,
    currentUser: CurrentUser,
  ) {
    const existingBug = await this.prisma.bug.findUnique({
      where: { id },
    });

    if (!existingBug) {
      throw new NotFoundException('Bug non trouvé');
    }

    const isAdmin = currentUser.role === RoleType.ADMIN;
    const isQaLead = currentUser.role === RoleType.QA_LEAD;
    const isReporter = existingBug.reporterId === currentUser.userId;
    const isAssignee = existingBug.assigneeId === currentUser.userId;

    if (!isAdmin && !isQaLead && !isReporter && !isAssignee) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de modifier ce bug",
      );
    }

    const updatedBug = await this.prisma.bug.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
        ...(data.steps !== undefined && {
          steps: data.steps?.trim() || null,
        }),
        ...(data.status && { status: data.status }),
        ...(data.severity && { severity: data.severity }),
        ...(data.priority && { priority: data.priority }),
        ...(data.projectId !== undefined && {
          projectId: data.projectId || null,
        }),
        ...(data.testCaseId !== undefined && {
          testCaseId: data.testCaseId || null,
        }),
        ...(data.executionId !== undefined && {
          executionId: data.executionId || null,
        }),
        ...(data.assigneeId !== undefined && {
          assigneeId: data.assigneeId || null,
        }),
      },
      include: {
        project: true,
        testCase: true,
        execution: true,
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        assignee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return {
      data: updatedBug,
      message: 'Bug mis à jour avec succès',
    };
  }

  async delete(
    id: string,
    currentUser: CurrentUser,
  ) {
    const bug = await this.prisma.bug.findUnique({
      where: { id },
    });

    if (!bug) {
      throw new NotFoundException('Bug non trouvé');
    }

    if (currentUser.role !== RoleType.ADMIN && currentUser.role !== RoleType.QA_LEAD) {
      throw new ForbiddenException(
        "Seuls l'administrateur ou le responsable QA peuvent supprimer un bug",
      );
    }

    await this.prisma.bug.delete({
      where: { id },
    });

    return {
      message: 'Bug supprimé avec succès',
    };
  }

  async getOptions(
    currentUser: CurrentUser,
    filters: {
      projectId?: string;
      suiteId?: string;
      campaignId?: string;
      iterationId?: string;
      testCaseId?: string;
    } = {},
  ) {
    const {
      projectId,
      suiteId,
      campaignId,
      iterationId,
      testCaseId,
    } = filters;
    const isAdmin = currentUser.role === RoleType.ADMIN;

    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          members: {
            where: { userId: currentUser.userId },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }

      if (!isAdmin && project.members.length === 0) {
        throw new ForbiddenException(
          "Vous n'avez pas accès à ce projet",
        );
      }
    }

    const projectWhere: Prisma.ProjectWhereInput = isAdmin
      ? {}
      : {
          members: {
            some: { userId: currentUser.userId },
          },
        };

    const suiteWhere: Prisma.TestSuiteWhereInput = projectId
      ? { projectId }
      : { id: { in: [] } };

    const testCaseWhere: Prisma.TestCaseWhereInput = projectId && suiteId
      ? {
          suiteId,
          suite: { projectId },
        }
      : { id: { in: [] } };

    const campaignWhere: Prisma.TestCampaignWhereInput = projectId
      ? { projectId }
      : { id: { in: [] } };

    const iterationWhere: Prisma.TestIterationWhereInput =
      projectId && campaignId
        ? {
            campaignId,
            campaign: { projectId },
          }
        : { id: { in: [] } };

    const executionWhere: Prisma.IterationItemWhereInput =
      projectId && iterationId
        ? {
            iterationId,
            iteration: {
              campaign: { projectId },
            },
            ...(testCaseId ? { testCaseId } : {}),
          }
        : { id: { in: [] } };

    const [
      projects,
      users,
      suites,
      testCases,
      campaigns,
      iterations,
      executions,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: projectWhere,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.user.findMany({
        orderBy: { email: 'asc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      }),
      this.prisma.testSuite.findMany({
        where: suiteWhere,
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          projectId: true,
        },
      }),
      this.prisma.testCase.findMany({
        where: testCaseWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          title: true,
          suite: {
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.testCampaign.findMany({
        where: campaignWhere,
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          projectId: true,
        },
      }),
      this.prisma.testIteration.findMany({
        where: iterationWhere,
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          status: true,
          campaignId: true,
        },
      }),
      this.prisma.iterationItem.findMany({
        where: executionWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          status: true,
          testCase: {
            select: {
              id: true,
              title: true,
            },
          },
          iteration: {
            select: {
              id: true,
              name: true,
              campaign: {
                select: {
                  id: true,
                  name: true,
                  project: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      projects,
      users,
      suites,
      testCases,
      campaigns,
      iterations,
      executions,
    };
  }
}
