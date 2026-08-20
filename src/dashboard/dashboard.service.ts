import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BugStatus,
  ExecutionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LighthouseService } from './lighthouse.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lighthouseService: LighthouseService,
  ) {}

  async getSummary(userId: string, projectId: string) {
    const project = await this.findAccessibleProject(
      userId,
      projectId,
    );

    const [
      openBugs,
      generatedTests,
      suites,
      executions,
      latestAudit,
    ] = await Promise.all([
      this.prisma.bug.count({
        where: {
          projectId,
          status: {
            in: [
              BugStatus.NEW,
              BugStatus.IN_PROGRESS,
              BugStatus.REOPENED,
            ],
          },
        },
      }),

      this.prisma.testCase.count({
        where: {
          suite: {
            projectId,
          },
          generationMode: {
            not: null,
          },
        },
      }),

      this.prisma.testSuite.findMany({
        where: {
          projectId,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),

      this.prisma.iterationItem.findMany({
        where: {
          testCase: {
            suite: {
              projectId,
            },
          },
          executedAt: {
            not: null,
          },
        },
        select: {
          status: true,
          executedAt: true,
          testCase: {
            select: {
              suiteId: true,
            },
          },
        },
      }),

      this.prisma.lighthouseAudit.findUnique({
        where: {
          projectId,
        },
      }),
    ]);

    const calculateStats = (suiteId?: string) => {
      const rows = suiteId
        ? executions.filter(
            (row) => row.testCase.suiteId === suiteId,
          )
        : executions;

      const success = rows.filter(
        (row) => row.status === ExecutionStatus.SUCCESS,
      ).length;

      const failed = rows.filter(
        (row) =>
          row.status === ExecutionStatus.FAILED ||
          row.status === ExecutionStatus.BLOCKED,
      ).length;

      const total = success + failed;

      const lastRunAt = rows.reduce<Date | null>(
        (latest, row) => {
          if (!row.executedAt) {
            return latest;
          }

          if (
            !latest ||
            row.executedAt.getTime() > latest.getTime()
          ) {
            return row.executedAt;
          }

          return latest;
        },
        null,
      );

      return {
        successRate:
          total > 0
            ? Math.round((success / total) * 100)
            : null,
        failures: failed,
        lastRunAt,
      };
    };

    return {
      project,
      openBugs,
      generatedTests,

      quality: latestAudit
        ? {
            requestedUrl: latestAudit.requestedUrl,
            finalUrl:
              latestAudit.finalUrl ??
              latestAudit.requestedUrl,
            qualityScore: latestAudit.qualityScore,
            scores: {
              performance: latestAudit.performance,
              accessibility: latestAudit.accessibility,
              bestPractices: latestAudit.bestPractices,
              seo: latestAudit.seo,
            },
            lighthouseVersion:
              latestAudit.lighthouseVersion,
            auditedAt: latestAudit.auditedAt,
            durationMs: latestAudit.durationMs ?? 0,
          }
        : null,

      modules: suites.map((suite) => ({
        id: suite.id,
        name: suite.name,
        ...calculateStats(suite.id),
      })),
    };
  }

  async runQualityAudit(
    userId: string,
    projectId: string,
  ) {
    const project = await this.findAccessibleProject(
      userId,
      projectId,
    );

    if (!project.baseUrl) {
      throw new BadRequestException(
        'Ce projet ne possède pas de baseUrl.',
      );
    }

    const result = await this.lighthouseService.audit(
      project.baseUrl,
    );

    await this.prisma.lighthouseAudit.upsert({
      where: {
        projectId,
      },
      create: {
        projectId,

        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,

        qualityScore: result.qualityScore,

        performance: result.scores.performance,
        accessibility: result.scores.accessibility,
        bestPractices: result.scores.bestPractices,
        seo: result.scores.seo,

        lighthouseVersion: result.lighthouseVersion,
        durationMs: result.durationMs,
        auditedAt: new Date(result.auditedAt),
      },
      update: {
        requestedUrl: result.requestedUrl,
        finalUrl: result.finalUrl,

        qualityScore: result.qualityScore,

        performance: result.scores.performance,
        accessibility: result.scores.accessibility,
        bestPractices: result.scores.bestPractices,
        seo: result.scores.seo,

        lighthouseVersion: result.lighthouseVersion,
        durationMs: result.durationMs,
        auditedAt: new Date(result.auditedAt),
      },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        baseUrl: project.baseUrl,
      },
      ...result,
    };
  }

  private async findAccessibleProject(
    userId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable ou inaccessible.',
      );
    }

    return project;
  }
}
