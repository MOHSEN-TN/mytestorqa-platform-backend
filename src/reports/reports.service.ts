import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BugSeverity,
  BugStatus,
  ExecutionStatus,
  ExecutionType,
  Prisma,
  ReportFormat,
  ReportStatus,
  ReportType,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsPdfService } from './reports-pdf.service';

type AuthUser = {
  userId: string;
  email: string;
  role: RoleType;
};

type CreateReportDto = {
  name: string;
  type: ReportType;
  format?: ReportFormat;
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

type DateRange = {
  from?: Date;
  to?: Date;
};

const ENABLED_REPORT_TYPES: ReportType[] = [
  ReportType.EXECUTION_SUMMARY,
  ReportType.BUG_REPORT,
  // TRENDS reste le type Prisma utilise par l'interface pour le rapport Qualite.
  ReportType.TRENDS,
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  async findAll(params: FindReportsParams) {
    const {
      page,
      limit,
      search,
      type = 'ALL',
      status = 'ALL',
      projectId,
    } = params;

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 100)
      : 10;
    const skip = (safePage - 1) * safeLimit;

    const andFilters: Prisma.ReportWhereInput[] = [
      { type: { in: ENABLED_REPORT_TYPES } },
      { format: ReportFormat.PDF },
    ];

    if (search?.trim()) {
      andFilters.push({
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { period: { contains: search.trim(), mode: 'insensitive' } },
        ],
      });
    }

    if (type !== 'ALL') {
      this.assertEnabledType(type);
      andFilters.push({ type });
    }

    if (status !== 'ALL') {
      andFilters.push({ status });
    }

    if (projectId) {
      andFilters.push({ projectId });
    }

    const where: Prisma.ReportWhereInput = { AND: andFilters };

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          project: { select: { id: true, name: true } },
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
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
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

    if (!report) throw new NotFoundException('Rapport non trouvé');
    return { data: report };
  }

  async create(data: CreateReportDto, currentUser: AuthUser) {
    if (!data.name?.trim()) {
      throw new BadRequestException('Le nom du rapport est obligatoire');
    }

    this.assertEnabledType(data.type);
    this.assertPdfOnly(data.format);

    if (data.projectId) await this.assertProjectExists(data.projectId);

    const period = data.period || '7 derniers jours';
    const generatedStats = await this.generateReportStats(
      data.type,
      data.projectId,
      period,
    );

    const report = await this.prisma.report.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        format: ReportFormat.PDF,
        status: ReportStatus.GENERATED,
        period,
        size: this.estimateReportSize(
          data.includeCharts ?? true,
          data.includeDetails ?? true,
          data.includeLogs ?? false,
        ),
        // L'URL finale est construite apres creation car elle depend de l'id.
        fileUrl: null,
        includeCharts: data.includeCharts ?? true,
        includeDetails: data.includeDetails ?? true,
        includeLogs: data.includeLogs ?? false,
        projectId: data.projectId,
        createdById: currentUser.userId,
      },
      include: {
        project: { select: { id: true, name: true } },
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

    const updated = await this.prisma.report.update({
      where: { id: report.id },
      data: { fileUrl: `/reports/${report.id}/download` },
      include: {
        project: { select: { id: true, name: true } },
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
      data: { ...updated, generatedStats },
      message: 'Rapport PDF généré avec succès',
    };
  }

  async update(id: string, data: UpdateReportDto, currentUser: AuthUser) {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rapport non trouvé');

    if (
      currentUser.role !== RoleType.ADMIN &&
      existing.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier ce rapport",
      );
    }

    if (data.type !== undefined) this.assertEnabledType(data.type);
    this.assertPdfOnly(data.format);
    if (data.projectId) await this.assertProjectExists(data.projectId);

    const report = await this.prisma.report.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.type !== undefined && { type: data.type }),
        format: ReportFormat.PDF,
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
        project: { select: { id: true, name: true } },
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

    return { data: report, message: 'Rapport mis à jour avec succès' };
  }

  async remove(id: string, currentUser: AuthUser) {
    const existing = await this.prisma.report.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rapport non trouvé');

    if (
      currentUser.role !== RoleType.ADMIN &&
      existing.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à supprimer ce rapport",
      );
    }

    await this.prisma.report.delete({ where: { id } });
    return { message: 'Rapport supprimé avec succès' };
  }

  async stats() {
    const generated = await this.prisma.report.count({
      where: {
        status: ReportStatus.GENERATED,
        format: ReportFormat.PDF,
        type: { in: ENABLED_REPORT_TYPES },
      },
    });

    return { generated };
  }

  async options() {
    const projects = await this.prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      types: ENABLED_REPORT_TYPES,
      formats: [ReportFormat.PDF],
      statuses: Object.values(ReportStatus),
      periods: [
        '7 derniers jours',
        '30 derniers jours',
        'Ce mois',
        'Trimestre actuel',
        'Cette année',
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

    if (!report) throw new NotFoundException('Rapport non trouvé');

    const generatedStats = await this.generateReportStats(
      report.type,
      report.projectId ?? undefined,
      report.period || '7 derniers jours',
    );

    return {
      data: {
        report,
        stats: generatedStats,
        summary: this.buildReportSummary(report.type),
      },
    };
  }

  async download(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!report) throw new NotFoundException('Rapport non trouvé');

    const generatedBy = this.userLabel(report.createdBy);
    const commonInput = {
      reportName: report.name,
      projectName: report.project?.name || 'Tous les projets',
      period: report.period || '7 derniers jours',
      generatedAt: new Date(),
      generatedBy,
      includeCharts: report.includeCharts,
      includeDetails: report.includeDetails,
    };

    if (report.type === ReportType.BUG_REPORT) {
      // IMPORTANT : le rapport Bugs validé reste inchangé.
      const bugStats = await this.generateBugStats(
        report.projectId ?? undefined,
        report.period || '7 derniers jours',
        report.includeDetails,
      );

      const buffer = this.reportsPdfService.buildBugReportPdf({
        ...commonInput,
        summary: bugStats.summary,
        byStatus: bugStats.byStatus,
        bySeverity: bugStats.bySeverity,
        byPriority: bugStats.byPriority,
        trend: bugStats.trend,
        criticalBugs: bugStats.criticalBugs,
      });

      return {
        buffer,
        fileName: `${this.slugify(report.name) || 'rapport-bugs'}.pdf`,
      };
    }

    if (report.type === ReportType.EXECUTION_SUMMARY) {
      const executionStats = await this.generateExecutionStats(
        report.projectId ?? undefined,
        report.period || '7 derniers jours',
        report.includeDetails,
      );

      const buffer = this.reportsPdfService.buildExecutionReportPdf({
        ...commonInput,
        includeLogs: report.includeLogs,
        summary: executionStats.summary,
        testInventory: executionStats.testInventory,
        executionsByMode: executionStats.executionsByMode,
        trend: executionStats.trend,
        failedTests: executionStats.failedTests,
        performance: executionStats.performance,
      });

      return {
        buffer,
        fileName: `${this.slugify(report.name) || 'rapport-execution'}.pdf`,
      };
    }

    if (report.type === ReportType.TRENDS) {
      const qualityStats = await this.generateQualityStats(
        report.projectId ?? undefined,
        report.period || '7 derniers jours',
      );

      const buffer = this.reportsPdfService.buildQualityReportPdf({
        ...commonInput,
        quality: qualityStats.quality,
        qaHealth: qualityStats.qaHealth,
        operational: qualityStats.operational,
        audit: qualityStats.audit,
      });

      return {
        buffer,
        fileName: `${this.slugify(report.name) || 'rapport-qualite'}.pdf`,
      };
    }

    throw new BadRequestException('Type de rapport PDF non pris en charge.');
  }

  private async generateReportStats(
    type: ReportType,
    projectId?: string | null,
    period = '7 derniers jours',
  ) {
    this.assertEnabledType(type);

    if (type === ReportType.BUG_REPORT) {
      return this.generateBugStats(projectId, period, true);
    }

    if (type === ReportType.TRENDS) {
      return this.generateQualityStats(projectId, period);
    }

    return this.generateExecutionStats(projectId, period, true);
  }

  private async generateQualityStats(
    projectId?: string | null,
    period = '7 derniers jours',
  ) {
    const [executionStats, bugStats, audits] = await Promise.all([
      this.generateExecutionStats(projectId, period, false),
      this.generateBugStats(projectId, period, false),
      projectId
        ? this.prisma.lighthouseAudit.findMany({
            where: { projectId },
            orderBy: { auditedAt: 'desc' },
            take: 1,
          })
        : this.prisma.lighthouseAudit.findMany({
            orderBy: { auditedAt: 'desc' },
          }),
    ]);

    const average = (values: Array<number | null | undefined>) => {
      const valid = values.filter(
        (value): value is number => typeof value === 'number',
      );
      return valid.length > 0
        ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
        : null;
    };

    const qualityScore = average(audits.map((audit) => audit.qualityScore));
    const performance = average(audits.map((audit) => audit.performance));
    const accessibility = average(audits.map((audit) => audit.accessibility));
    const bestPractices = average(audits.map((audit) => audit.bestPractices));
    const seo = average(audits.map((audit) => audit.seo));

    const automationRate =
      executionStats.testInventory.total > 0
        ? Math.round(
            (executionStats.testInventory.automated /
              executionStats.testInventory.total) *
              100,
          )
        : 0;

    const latestAudit = audits[0] ?? null;

    return {
      quality: {
        qualityScore,
        performance,
        accessibility,
        bestPractices,
        seo,
      },
      qaHealth: {
        successRate: executionStats.summary.successRate,
        bugResolutionRate: bugStats.summary.resolutionRate,
        automationRate,
      },
      operational: {
        totalTests: executionStats.testInventory.total,
        totalExecutions: executionStats.summary.total,
        openBugs: bugStats.summary.open,
        criticalBugs: bugStats.summary.critical,
      },
      audit: latestAudit
        ? {
            requestedUrl: latestAudit.requestedUrl,
            finalUrl: latestAudit.finalUrl ?? latestAudit.requestedUrl,
            lighthouseVersion: latestAudit.lighthouseVersion ?? null,
            auditedAt: latestAudit.auditedAt,
            auditsCount: audits.length,
          }
        : {
            requestedUrl: null,
            finalUrl: null,
            lighthouseVersion: null,
            auditedAt: null,
            auditsCount: 0,
          },
      // Alias simples pour l'aperçu frontend.
      qualityScore,
      performance,
      accessibility,
      bestPractices,
      seo,
      successRate: executionStats.summary.successRate,
      bugResolutionRate: bugStats.summary.resolutionRate,
      automationRate,
      totalTests: executionStats.testInventory.total,
      totalExecutions: executionStats.summary.total,
      openBugs: bugStats.summary.open,
      criticalBugs: bugStats.summary.critical,
    };
  }

  private async generateExecutionStats(
    projectId?: string | null,
    period = '7 derniers jours',
    includeDetails = true,
  ) {
    const range = this.resolvePeriod(period);
    const completedStatuses: ExecutionStatus[] = [
      ExecutionStatus.SUCCESS,
      ExecutionStatus.FAILED,
      ExecutionStatus.BLOCKED,
      ExecutionStatus.SKIPPED,
    ];

    const executionWhere = this.buildExecutionWhere(projectId, range);
    const completedWhere: Prisma.IterationItemWhereInput = {
      ...executionWhere,
      status: { in: completedStatuses },
    };

    const testCaseWhere: Prisma.TestCaseWhereInput = projectId
      ? { suite: { projectId } }
      : {};

    const automatedTestWhere: Prisma.TestCaseWhereInput = {
      ...testCaseWhere,
      OR: [
        { automationCode: { not: null } },
        { automationFramework: { not: null } },
      ],
    };

    const [
      totalExecutions,
      success,
      failed,
      blocked,
      skipped,
      manualExecutions,
      automatedExecutions,
      totalProjectTests,
      automatedTests,
      timelineRows,
      failedRows,
      durationRows,
    ] = await Promise.all([
      this.prisma.iterationItem.count({ where: completedWhere }),
      this.prisma.iterationItem.count({
        where: { ...executionWhere, status: ExecutionStatus.SUCCESS },
      }),
      this.prisma.iterationItem.count({
        where: { ...executionWhere, status: ExecutionStatus.FAILED },
      }),
      this.prisma.iterationItem.count({
        where: { ...executionWhere, status: ExecutionStatus.BLOCKED },
      }),
      this.prisma.iterationItem.count({
        where: { ...executionWhere, status: ExecutionStatus.SKIPPED },
      }),
      this.prisma.iterationItem.count({
        where: {
          ...completedWhere,
          executionType: ExecutionType.MANUAL,
        },
      }),
      this.prisma.iterationItem.count({
        where: {
          ...completedWhere,
          executionType: ExecutionType.AUTOMATED,
        },
      }),
      this.prisma.testCase.count({ where: testCaseWhere }),
      this.prisma.testCase.count({ where: automatedTestWhere }),
      this.prisma.iterationItem.findMany({
        where: completedWhere,
        select: { executedAt: true },
        orderBy: { executedAt: 'asc' },
      }),
      includeDetails
        ? this.prisma.iterationItem.findMany({
            where: {
              ...executionWhere,
              status: ExecutionStatus.FAILED,
            },
            select: {
              id: true,
              status: true,
              executionType: true,
              duration: true,
              browser: true,
              error: true,
              executedAt: true,
              testCase: {
                select: {
                  id: true,
                  title: true,
                  suite: { select: { name: true } },
                },
              },
            },
            orderBy: { executedAt: 'desc' },
            take: 15,
          })
        : Promise.resolve([]),
      this.prisma.iterationItem.findMany({
        where: {
          ...completedWhere,
          duration: { not: null },
        },
        select: { duration: true },
      }),
    ]);

    const successRate =
      totalExecutions > 0
        ? Math.round((success / totalExecutions) * 100)
        : 0;

    const manualTests = Math.max(0, totalProjectTests - automatedTests);

    const durations = durationRows
      .map((row) => row.duration)
      .filter((value): value is number => typeof value === 'number');
    const averageDurationMs =
      durations.length > 0
        ? Math.round(
            durations.reduce((sum, value) => sum + value, 0) /
              durations.length,
          )
        : 0;
    const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;

    const failedTests = (failedRows as any[]).map((row) => ({
      id: String(row.id),
      testId: String(row.testCase?.id ?? '-'),
      title: String(row.testCase?.title ?? `Test ${row.id}`),
      suite: String(row.testCase?.suite?.name ?? '-'),
      mode: String(row.executionType ?? '-'),
      status: String(row.status ?? '-'),
      duration: typeof row.duration === 'number' ? row.duration : null,
      browser: row.browser ? String(row.browser) : null,
      error: row.error ? String(row.error) : null,
      executedAt: row.executedAt ?? null,
    }));

    const trend = this.buildDailyExecutionTrend(
      timelineRows
        .map((row) => row.executedAt)
        .filter((value): value is Date => value instanceof Date),
    );

    return {
      summary: {
        total: totalExecutions,
        success,
        failed,
        blocked,
        skipped,
        successRate,
      },
      testInventory: {
        total: totalProjectTests,
        manual: manualTests,
        automated: automatedTests,
      },
      executionsByMode: {
        manual: manualExecutions,
        automated: automatedExecutions,
      },
      trend,
      failedTests,
      performance: {
        averageDurationMs,
        maxDurationMs,
      },
      // Alias simples pour l'aperçu et le rapport Qualité futur.
      totalExecutions,
      success,
      failed,
      blocked,
      skipped,
      successRate,
      manualTests,
      automatedTests,
      manualExecutions,
      automatedExecutions,
      averageDurationMs,
    };
  }

  private buildExecutionWhere(
    projectId: string | null | undefined,
    range: DateRange,
  ): Prisma.IterationItemWhereInput {
    const where: Prisma.IterationItemWhereInput = {};

    if (projectId) {
      where.iteration = { campaign: { projectId } };
    }

    if (range.from || range.to) {
      where.executedAt = {
        ...(range.from && { gte: range.from }),
        ...(range.to && { lte: range.to }),
      };
    }

    return where;
  }

  private buildDailyExecutionTrend(dates: Date[]) {
    const counts = new Map<string, number>();

    for (const date of dates) {
      const key = new Date(date).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, executed]) => ({ date, executed }));
  }

  private async generateBugStats(
    projectId?: string | null,
    period = '7 derniers jours',
    includeDetails = true,
  ) {
    const range = this.resolvePeriod(period);
    const where = this.buildBugWhere(projectId, range);

    const [
      total,
      open,
      resolved,
      critical,
      byStatusRaw,
      bySeverityRaw,
      byPriorityRaw,
      timelineRows,
      criticalRows,
    ] = await Promise.all([
        this.prisma.bug.count({ where }),
        this.prisma.bug.count({
          where: {
            ...where,
            status: {
              in: [BugStatus.NEW, BugStatus.IN_PROGRESS, BugStatus.REOPENED],
            },
          },
        }),
        this.prisma.bug.count({
          where: { ...where, status: { in: [BugStatus.RESOLVED, BugStatus.CLOSED] } },
        }),
        this.prisma.bug.count({
          where: {
            ...where,
            severity: { in: [BugSeverity.CRITICAL, BugSeverity.BLOCKER] },
          },
        }),
        this.prisma.bug.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.bug.groupBy({
          by: ['severity'],
          where,
          _count: { _all: true },
        }),
        this.prisma.bug.groupBy({
          by: ['priority'],
          where,
          _count: { _all: true },
        }),
        this.prisma.bug.findMany({
          where,
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        includeDetails
          ? this.prisma.bug.findMany({
              where: {
                ...where,
                severity: { in: [BugSeverity.CRITICAL, BugSeverity.BLOCKER] },
              },
              orderBy: { createdAt: 'desc' },
              take: 15,
            })
          : Promise.resolve([]),
      ]);

    const resolutionRate =
      total > 0 ? Math.round((resolved / total) * 100) : 0;

    const byStatus = byStatusRaw.map((item) => ({
      label: String(item.status),
      count: item._count._all,
    }));

    const bySeverity = bySeverityRaw
      .map((item) => ({
        label: String(item.severity),
        count: item._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    const byPriority = byPriorityRaw
      .map((item) => ({
        label: String(item.priority),
        count: item._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    byStatus.sort((a, b) => b.count - a.count);

    const criticalBugs = (criticalRows as any[]).map((bug) => ({
      id: String(bug.id),
      title: String(
        bug.title ?? bug.name ?? bug.summary ?? bug.description ?? `Bug ${bug.id}`,
      ),
      status: String(bug.status ?? '-'),
      severity: String(bug.severity ?? '-'),
      priority: bug.priority ? String(bug.priority) : null,
      createdAt: bug.createdAt ?? null,
    }));

    return {
      summary: {
        total,
        open,
        resolved,
        critical,
        resolutionRate,
      },
      byStatus,
      bySeverity,
      byPriority,
      trend: this.buildDailyTrend(timelineRows.map((row) => row.createdAt)),
      criticalBugs,
      // Alias simples conserves pour les apercus/clients existants.
      totalBugs: total,
      openBugs: open,
      resolvedBugs: resolved,
      criticalBugsCount: critical,
      resolutionRate,
    };
  }

  private buildBugWhere(projectId: string | null | undefined, range: DateRange) {
    const where: Prisma.BugWhereInput = {};

    if (projectId) where.projectId = projectId;

    if (range.from || range.to) {
      where.createdAt = {
        ...(range.from && { gte: range.from }),
        ...(range.to && { lte: range.to }),
      };
    }

    return where;
  }

  private resolvePeriod(period: string): DateRange {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (period === '30 derniers jours') {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to: end };
    }

    if (period === 'Ce mois') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: end,
      };
    }

    if (period === 'Trimestre actuel') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: new Date(now.getFullYear(), quarterStartMonth, 1),
        to: end,
      };
    }

    if (period === 'Cette année') {
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: end,
      };
    }

    // Valeur par defaut et "7 derniers jours".
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to: end };
  }

  private buildDailyTrend(dates: Date[]) {
    const counts = new Map<string, number>();

    for (const date of dates) {
      const key = new Date(date).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, created]) => ({ date, created }));
  }

  private assertEnabledType(type: ReportType) {
    if (!ENABLED_REPORT_TYPES.includes(type)) {
      throw new BadRequestException(
        'Type de rapport invalide. Types autorisés : Exécution, Bugs, Qualité.',
      );
    }
  }

  private assertPdfOnly(format?: ReportFormat) {
    if (format !== undefined && format !== ReportFormat.PDF) {
      throw new BadRequestException(
        'Seul le format PDF est disponible pour le moment.',
      );
    }
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projet non trouvé');
  }

  private estimateReportSize(
    includeCharts: boolean,
    includeDetails: boolean,
    includeLogs: boolean,
  ) {
    let sizeMb = 0.3;
    if (includeCharts) sizeMb += 0.2;
    if (includeDetails) sizeMb += 0.3;
    if (includeLogs) sizeMb += 0.7;
    return `${sizeMb.toFixed(1)} MB`;
  }

  private buildReportSummary(type: ReportType) {
    const summaries: Partial<Record<ReportType, string>> = {
      [ReportType.EXECUTION_SUMMARY]:
        "Synthèse des exécutions de tests : succès, échecs, tests bloqués, ignorés et progression.",
      [ReportType.BUG_REPORT]:
        'Synthèse des anomalies : volume, statut, sévérité, criticité et état de résolution.',
      [ReportType.TRENDS]:
        'Vue qualité globale combinant score qualité, résultats d’exécution et indicateurs de bugs.',
    };
    return summaries[type] || 'Rapport QA.';
  }

  private userLabel(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || '-';
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
