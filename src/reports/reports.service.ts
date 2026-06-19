import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BugStatus,
  ExecutionStatus,
  Prisma,
  ReportFormat,
  ReportStatus,
  ReportType,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuthUser = {
  userId: string;
  email: string;
  role: RoleType;
};

type CreateReportDto = {
  name: string;
  type: ReportType;
  format: ReportFormat;
  period?: string;
  projectId?: string;
  includeCharts?: boolean;
  includeDetails?: boolean;
  includeLogs?: boolean;
};

type UpdateReportDto = Partial<CreateReportDto> & {
  status?: ReportStatus;
};

type FindReportsParams = {
  page: number;
  limit: number;
  search?: string;
  type?: ReportType | 'ALL';
  format?: ReportFormat | 'ALL';
  status?: ReportStatus | 'ALL';
  projectId?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: FindReportsParams) {
    const {
      page,
      limit,
      search,
      type = 'ALL',
      format = 'ALL',
      status = 'ALL',
      projectId,
    } = params;

    const skip = (page - 1) * limit;

    const andFilters: Prisma.ReportWhereInput[] = [];

    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { period: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (type !== 'ALL') {
      andFilters.push({ type });
    }

    if (format !== 'ALL') {
      andFilters.push({ format });
    }

    if (status !== 'ALL') {
      andFilters.push({ status });
    }

    if (projectId) {
      andFilters.push({ projectId });
    }

    const where: Prisma.ReportWhereInput =
      andFilters.length > 0 ? { AND: andFilters } : {};

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
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
          createdBy: {
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
      this.prisma.report.count({ where }),
    ]);

    return {
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
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

    if (!report) {
      throw new NotFoundException('Rapport non trouvé');
    }

    return { data: report };
  }

  async create(data: CreateReportDto, currentUser: AuthUser) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Le nom du rapport est obligatoire');
    }

    if (data.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new NotFoundException('Projet non trouvé');
      }
    }

    const generatedStats = await this.generateReportStats(
      data.type,
      data.projectId,
    );

    const size = this.estimateReportSize(
      data.format,
      data.includeCharts ?? true,
      data.includeDetails ?? true,
      data.includeLogs ?? false,
    );

    const report = await this.prisma.report.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        format: data.format,
        status: ReportStatus.GENERATED,
        period: data.period,
        size,
        fileUrl: this.buildFakeFileUrl(data.name, data.format),

        includeCharts: data.includeCharts ?? true,
        includeDetails: data.includeDetails ?? true,
        includeLogs: data.includeLogs ?? false,

        projectId: data.projectId,
        createdById: currentUser.userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
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
      data: {
        ...report,
        generatedStats,
      },
      message: 'Rapport généré avec succès',
    };
  }

  async update(id: string, data: UpdateReportDto, currentUser: AuthUser) {
    const existing = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Rapport non trouvé');
    }

    if (
      currentUser.role !== RoleType.ADMIN &&
      existing.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier ce rapport",
      );
    }

    if (data.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: data.projectId },
      });

      if (!project) {
        throw new NotFoundException('Projet non trouvé');
      }
    }

    const report = await this.prisma.report.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.format !== undefined && { format: data.format }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.period !== undefined && { period: data.period }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.includeCharts !== undefined && {
          includeCharts: data.includeCharts,
        }),
        ...(data.includeDetails !== undefined && {
          includeDetails: data.includeDetails,
        }),
        ...(data.includeLogs !== undefined && {
          includeLogs: data.includeLogs,
        }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
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
      data: report,
      message: 'Rapport mis à jour avec succès',
    };
  }

  async remove(id: string, currentUser: AuthUser) {
    const existing = await this.prisma.report.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Rapport non trouvé');
    }

    if (
      currentUser.role !== RoleType.ADMIN &&
      existing.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à supprimer ce rapport",
      );
    }

    await this.prisma.report.delete({
      where: { id },
    });

    return {
      message: 'Rapport supprimé avec succès',
    };
  }

  async stats() {
    const [total, generated, scheduled, generating, failed] = await Promise.all([
      this.prisma.report.count(),
      this.prisma.report.count({
        where: { status: ReportStatus.GENERATED },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.SCHEDULED },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.GENERATING },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.FAILED },
      }),
    ]);

    const reports = await this.prisma.report.findMany({
      select: {
        size: true,
      },
    });

    const storageUsedMb = reports.reduce((acc, report) => {
      return acc + this.parseSizeToMb(report.size);
    }, 0);

    return {
      total,
      generated,
      scheduled,
      generating,
      failed,
      storageUsed: `${storageUsedMb.toFixed(1)} MB`,
    };
  }

  async options() {
    const projects = await this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      types: Object.values(ReportType),
      formats: Object.values(ReportFormat),
      statuses: Object.values(ReportStatus),
      periods: [
        '7 derniers jours',
        '30 derniers jours',
        'Ce mois',
        'Trimestre actuel',
        'Cette année',
        'Personnalisé',
      ],
      projects,
    };
  }

  async preview(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        project: true,
        createdBy: {
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

    if (!report) {
      throw new NotFoundException('Rapport non trouvé');
    }

    const generatedStats = await this.generateReportStats(
      report.type,
      report.projectId ?? undefined,
    );

    return {
      data: {
        report,
        stats: generatedStats,
        summary: this.buildReportSummary(report.type),
      },
    };
  }

  private async generateReportStats(type: ReportType, projectId?: string | null) {
    const projectFilter = projectId ? { projectId } : {};

    if (type === ReportType.BUG_REPORT) {
      const [total, open, resolved, critical] = await Promise.all([
        this.prisma.bug.count({ where: projectFilter }),
        this.prisma.bug.count({
          where: {
            ...projectFilter,
            status: {
              in: [
                BugStatus.NEW,
                BugStatus.IN_PROGRESS,
                BugStatus.REOPENED,
              ],
            },
          },
        }),
        this.prisma.bug.count({
          where: {
            ...projectFilter,
            status: BugStatus.RESOLVED,
          },
        }),
        this.prisma.bug.count({
          where: {
            ...projectFilter,
            severity: {
              in: ['CRITICAL', 'BLOCKER'],
            },
          },
        }),
      ]);

      return {
        totalBugs: total,
        openBugs: open,
        resolvedBugs: resolved,
        criticalBugs: critical,
      };
    }

    const iterationWhere: Prisma.IterationItemWhereInput = projectId
      ? {
          iteration: {
            campaign: {
              projectId,
            },
          },
        }
      : {};

    const [totalExecutions, success, failed, blocked, skipped, todo] =
      await Promise.all([
        this.prisma.iterationItem.count({ where: iterationWhere }),
        this.prisma.iterationItem.count({
          where: { ...iterationWhere, status: ExecutionStatus.SUCCESS },
        }),
        this.prisma.iterationItem.count({
          where: { ...iterationWhere, status: ExecutionStatus.FAILED },
        }),
        this.prisma.iterationItem.count({
          where: { ...iterationWhere, status: ExecutionStatus.BLOCKED },
        }),
        this.prisma.iterationItem.count({
          where: { ...iterationWhere, status: ExecutionStatus.SKIPPED },
        }),
        this.prisma.iterationItem.count({
          where: { ...iterationWhere, status: ExecutionStatus.TODO },
        }),
      ]);

    const successRate =
      totalExecutions > 0
        ? Math.round((success / totalExecutions) * 100)
        : 0;

    return {
      totalExecutions,
      success,
      failed,
      blocked,
      skipped,
      todo,
      successRate,
    };
  }

  private estimateReportSize(
    format: ReportFormat,
    includeCharts: boolean,
    includeDetails: boolean,
    includeLogs: boolean,
  ) {
    let sizeMb = 0.4;

    if (format === ReportFormat.PDF) sizeMb += 1.1;
    if (format === ReportFormat.EXCEL) sizeMb += 0.8;
    if (format === ReportFormat.HTML) sizeMb += 0.3;

    if (includeCharts) sizeMb += 0.6;
    if (includeDetails) sizeMb += 0.9;
    if (includeLogs) sizeMb += 1.5;

    return `${sizeMb.toFixed(1)} MB`;
  }

  private parseSizeToMb(size?: string | null) {
    if (!size) return 0;

    const value = Number(size.replace('MB', '').trim());

    if (Number.isNaN(value)) {
      return 0;
    }

    return value;
  }

  private buildFakeFileUrl(name: string, format: ReportFormat) {
    const safeName = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const extension =
      format === ReportFormat.PDF
        ? 'pdf'
        : format === ReportFormat.EXCEL
          ? 'xlsx'
          : 'html';

    return `/reports/${safeName || 'rapport'}.${extension}`;
  }

  private buildReportSummary(type: ReportType) {
    const summaries: Record<ReportType, string> = {
      EXECUTION_SUMMARY:
        "Résumé global des exécutions de tests, incluant les succès, échecs, tests bloqués et progression.",
      COVERAGE:
        'Analyse de la couverture des cas de test par projet, suite et campagne.',
      TRENDS:
        'Analyse des tendances QA : évolution des résultats, stabilité et progression dans le temps.',
      BUG_REPORT:
        'Synthèse des anomalies détectées avec statut, sévérité, priorité et affectation.',
      PERFORMANCE:
        'Vue synthétique de la performance des campagnes de test et du temps d’exécution.',
    };

    return summaries[type];
  }
}