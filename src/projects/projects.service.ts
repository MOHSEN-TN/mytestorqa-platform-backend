import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async listProjects(userId: string, name?: string) {
    return this.prisma.project.findMany({
      where: {
        members: {
          some: { userId },
        },
        ...(name && {
          name: {
            contains: name,
            mode: 'insensitive',   // case-insensitive
          },
        }),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
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
      },
    });
  }

  async createProject(userId: string, name: string) {
    return this.prisma.project.create({
      data: {
        name,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
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
      },
    });
  }

  async updateProject(id: string, name: string) {
    return this.prisma.project.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        createdAt: true,
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
      },
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
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        testSuites: {
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
        select: {
          id: true,
          name: true,
          createdAt: true,
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
        },
      });
    });
  }
}