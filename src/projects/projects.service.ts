import { Injectable, NotFoundException } from '@nestjs/common';
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
  ) {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.max(1, Math.min(100, pagination.limit || 10));
    const skip = (page - 1) * limit;

    const where = {
      members: { some: { userId } },
      ...(name?.trim() && {
        name: { contains: name.trim(), mode: 'insensitive' as const },
      }),
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

  async deleteProject(id: string) {
    await this.prisma.projectMember.deleteMany({
      where: { projectId: id },
    });

    return this.prisma.project.delete({
      where: { id },
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
