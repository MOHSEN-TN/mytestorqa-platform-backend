import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ContextTopic =
  | 'overview'
  | 'members'
  | 'tests'
  | 'campaigns'
  | 'executions'
  | 'bugs'
  | 'reports'
  | 'ai'
  | 'quality';

const ALL_DATA_TOPICS: ContextTopic[] = [
  'members',
  'tests',
  'campaigns',
  'executions',
  'bugs',
  'reports',
  'ai',
  'quality',
];

@Injectable()
export class SmartQaContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPlatformContext(
    projectId?: string,
    explorationId?: string,
    question = '',
  ) {
    if (!projectId && !explorationId) {
      return {
        scope: 'global',
        dataSource: 'PostgreSQL via Prisma (lecture seule)',
        message:
          'Aucun projet n’est sélectionné. Répondre avec des conseils QA généraux.',
      };
    }

    const topics = this.detectTopics(question);
    const project = projectId
      ? await this.loadProjectSummary(projectId)
      : undefined;
    const exploration = explorationId
      ? await this.loadExplorationContext(explorationId)
      : undefined;

    if (topics.has('overview')) {
      topics.add('tests');
      topics.add('bugs');
    }

    const [members, tests, campaigns, executions, bugs, reports, ai, quality] =
      await Promise.all([
        projectId && topics.has('members')
          ? this.loadMembers(projectId)
          : undefined,
        projectId && topics.has('tests')
          ? this.loadTests(projectId)
          : undefined,
        projectId && topics.has('campaigns')
          ? this.loadCampaigns(projectId)
          : undefined,
        projectId && topics.has('executions')
          ? this.loadExecutions(projectId)
          : undefined,
        projectId && topics.has('bugs')
          ? this.loadBugs(projectId)
          : undefined,
        projectId && topics.has('reports')
          ? this.loadReports(projectId)
          : undefined,
        projectId && topics.has('ai') ? this.loadAi(projectId) : undefined,
        projectId && topics.has('quality')
          ? this.loadQuality(projectId)
          : undefined,
      ]);

    return {
      scope: exploration ? 'exploration' : 'project',
      dataSource: 'PostgreSQL via Prisma (lecture seule)',
      loadedSections: [
        'project',
        ...(exploration ? ['selectedExploration'] : []),
        ...Array.from(topics).filter((topic) => topic !== 'overview'),
      ],
      security: {
        policy: 'whitelist',
        note:
          'Les secrets, mots de passe, OTP, jetons et identifiants sensibles ne sont jamais chargés dans le contexte SMART-QA.',
      },
      project,
      selectedExploration: exploration,
      relevantData: {
        members,
        tests,
        campaigns,
        executions,
        bugs,
        reports,
        ai,
        quality,
      },
    };
  }

  private detectTopics(question: string) {
    const normalized = this.normalize(question);
    const topics = new Set<ContextTopic>();

    const asksForEverything = this.hasAny(normalized, [
      'toutes les donnees',
      'toute les donnees',
      'tout le projet',
      'toutes les informations',
      'toutes les infos',
      'all data',
      'all project data',
      'everything',
    ]);

    if (asksForEverything) {
      ALL_DATA_TOPICS.forEach((topic) => topics.add(topic));
      return topics;
    }

    if (
      this.hasAny(normalized, [
        'membre',
        'membres',
        'utilisateur',
        'utilisateurs',
        'user',
        'users',
        'owner',
        'qa lead',
        'tester',
        'equipe',
        'team',
      ])
    ) {
      topics.add('members');
    }

    if (
      this.hasAny(normalized, [
        'test',
        'tests',
        'cas de test',
        'test case',
        'testcase',
        'suite',
        'step',
        'etape',
        'gherkin',
        'playwright',
        'selenium',
        'cypress',
        'automatisation',
        'automation',
      ])
    ) {
      topics.add('tests');
    }

    if (
      this.hasAny(normalized, [
        'campagne',
        'campagnes',
        'campaign',
        'campaigns',
        'iteration',
        'iterations',
      ])
    ) {
      topics.add('campaigns');
    }

    if (
      this.hasAny(normalized, [
        'execution',
        'executions',
        'run',
        'runs',
        'execute',
        'failed',
        'failure',
        'echec',
        'echoue',
        'success',
        'reussi',
        'blocked',
        'bloque',
        'skipped',
        'duration',
        'duree',
        'screenshot',
        'trace',
        'artifact',
        'logs',
      ])
    ) {
      topics.add('executions');
    }

    if (
      this.hasAny(normalized, [
        'bug',
        'bugs',
        'anomalie',
        'anomalies',
        'defaut',
        'incident',
        'severity',
        'severite',
        'critical',
        'critique',
        'blocker',
        'urgent',
      ])
    ) {
      topics.add('bugs');
    }

    if (
      this.hasAny(normalized, [
        'rapport',
        'rapports',
        'report',
        'reports',
        'pdf',
        'excel',
        'coverage',
        'couverture',
        'trend',
        'tendance',
      ])
    ) {
      topics.add('reports');
    }

    if (
      this.hasAny(normalized, [
        'exploration',
        'explorations',
        'suggestion',
        'suggestions',
        'ai ',
        ' ia ',
        'ollama',
        'gemini',
        'generation ia',
        'generation ai',
        'target url',
        'targeturl',
        'url cible',
      ])
    ) {
      topics.add('ai');
    }

    if (
      this.hasAny(normalized, [
        'lighthouse',
        'performance',
        'accessibility',
        'accessibilite',
        'seo',
        'best practices',
        'bonnes pratiques',
        'quality score',
        'score qualite',
      ])
    ) {
      topics.add('quality');
    }

    if (topics.size === 0) {
      topics.add('overview');
    }

    return topics;
  }

  private async loadProjectSummary(projectId: string) {
    const [project, testCaseCount, iterationCount, executionCount] =
      await Promise.all([
        this.prisma.project.findUnique({
          where: { id: projectId },
          select: {
            id: true,
            name: true,
            description: true,
            baseUrl: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                members: true,
                testSuites: true,
                campaigns: true,
                bugs: true,
                reports: true,
                aiExplorations: true,
              },
            },
            lighthouseAudit: {
              select: { id: true },
            },
          },
        }),
        this.prisma.testCase.count({
          where: { suite: { projectId } },
        }),
        this.prisma.testIteration.count({
          where: { campaign: { projectId } },
        }),
        this.prisma.iterationItem.count({
          where: { iteration: { campaign: { projectId } } },
        }),
      ]);

    if (!project) {
      return null;
    }

    const { _count, lighthouseAudit, ...safeProject } = project;

    return {
      ...safeProject,
      counts: {
        members: _count.members,
        testSuites: _count.testSuites,
        testCases: testCaseCount,
        campaigns: _count.campaigns,
        iterations: iterationCount,
        executions: executionCount,
        bugs: _count.bugs,
        reports: _count.reports,
        aiExplorations: _count.aiExplorations,
        lighthouseAudits: lighthouseAudit ? 1 : 0,
      },
    };
  }

  private async loadMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  private async loadTests(projectId: string) {
    const [statusCounts, sourceCounts, suites, recentTestCases] =
      await Promise.all([
        this.prisma.testCase.groupBy({
          by: ['status'],
          where: { suite: { projectId } },
          _count: { _all: true },
        }),
        this.prisma.testCase.groupBy({
          by: ['sourceType'],
          where: { suite: { projectId } },
          _count: { _all: true },
        }),
        this.prisma.testSuite.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            name: true,
            description: true,
            updatedAt: true,
            _count: { select: { testCases: true } },
          },
        }),
        this.prisma.testCase.findMany({
          where: { suite: { projectId } },
          orderBy: { updatedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            title: true,
            description: true,
            expected: true,
            status: true,
            priority: true,
            sourceType: true,
            generationMode: true,
            automationFramework: true,
            updatedAt: true,
            suite: { select: { id: true, name: true } },
            steps: {
              orderBy: { stepOrder: 'asc' },
              take: 12,
              select: {
                stepOrder: true,
                action: true,
                expected: true,
              },
            },
          },
        }),
      ]);

    return {
      byStatus: statusCounts,
      bySourceType: sourceCounts,
      suites,
      recentTestCases,
    };
  }

  private async loadCampaigns(projectId: string) {
    const campaigns = await this.prisma.testCampaign.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      take: 25,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        iterations: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return { campaigns };
  }

  private async loadExecutions(projectId: string) {
    const [statusCounts, typeCounts, recentExecutions] = await Promise.all([
      this.prisma.iterationItem.groupBy({
        by: ['status'],
        where: { iteration: { campaign: { projectId } } },
        _count: { _all: true },
      }),
      this.prisma.iterationItem.groupBy({
        by: ['executionType'],
        where: { iteration: { campaign: { projectId } } },
        _count: { _all: true },
      }),
      this.prisma.iterationItem.findMany({
        where: { iteration: { campaign: { projectId } } },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          executionType: true,
          status: true,
          comment: true,
          duration: true,
          startedAt: true,
          finishedAt: true,
          executedAt: true,
          automationRunId: true,
          browser: true,
          executionMode: true,
          error: true,
          screenshotUrl: true,
          traceUrl: true,
          artifactsZipUrl: true,
          executionReportUrl: true,
          automationFrameworkSnapshot: true,
          updatedAt: true,
          testCase: {
            select: {
              id: true,
              title: true,
              priority: true,
              suite: { select: { id: true, name: true } },
            },
          },
          iteration: {
            select: {
              id: true,
              name: true,
              status: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      byStatus: statusCounts,
      byExecutionType: typeCounts,
      recentExecutions,
    };
  }

  private async loadBugs(projectId: string) {
    const [statusCounts, severityCounts, priorityCounts, recentBugs] =
      await Promise.all([
        this.prisma.bug.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { _all: true },
        }),
        this.prisma.bug.groupBy({
          by: ['severity'],
          where: { projectId },
          _count: { _all: true },
        }),
        this.prisma.bug.groupBy({
          by: ['priority'],
          where: { projectId },
          _count: { _all: true },
        }),
        this.prisma.bug.findMany({
          where: { projectId },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true,
            title: true,
            description: true,
            steps: true,
            status: true,
            severity: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            testCase: {
              select: { id: true, title: true },
            },
            execution: {
              select: { id: true, status: true, executedAt: true },
            },
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
      ]);

    return {
      byStatus: statusCounts,
      bySeverity: severityCounts,
      byPriority: priorityCounts,
      recentBugs,
    };
  }

  private async loadReports(projectId: string) {
    const [statusCounts, typeCounts, reports] = await Promise.all([
      this.prisma.report.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.report.groupBy({
        by: ['type'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.report.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          name: true,
          type: true,
          format: true,
          status: true,
          period: true,
          size: true,
          fileUrl: true,
          includeCharts: true,
          includeDetails: true,
          includeLogs: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return { byStatus: statusCounts, byType: typeCounts, reports };
  }

  private async loadAi(projectId: string) {
    const [statusCounts, modeCounts, explorations] = await Promise.all([
      this.prisma.aIExploration.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.aIExploration.groupBy({
        by: ['generationMode'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.aIExploration.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: {
          id: true,
          title: true,
          prompt: true,
          context: true,
          generationMode: true,
          aiModel: true,
          targetUrl: true,
          depth: true,
          authenticationRequired: true,
          generatePlaywright: true,
          generateGherkin: true,
          generateNegativeTests: true,
          status: true,
          generatedCount: true,
          fallbackUsed: true,
          lastError: true,
          generationDurationMs: true,
          promptTokens: true,
          completionTokens: true,
          lastGeneratedAt: true,
          createdAt: true,
          updatedAt: true,
          suggestions: {
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: {
              id: true,
              title: true,
              description: true,
              expectedResult: true,
              priority: true,
              status: true,
              sourcePageUrl: true,
              aiConfidence: true,
            },
          },
        },
      }),
    ]);

    return {
      byStatus: statusCounts,
      byGenerationMode: modeCounts,
      explorations,
    };
  }

  private async loadQuality(projectId: string) {
    return this.prisma.lighthouseAudit.findUnique({
      where: { projectId },
      select: {
        id: true,
        requestedUrl: true,
        finalUrl: true,
        qualityScore: true,
        performance: true,
        accessibility: true,
        bestPractices: true,
        seo: true,
        lighthouseVersion: true,
        durationMs: true,
        auditedAt: true,
      },
    });
  }

  private async loadExplorationContext(explorationId: string) {
    return this.prisma.aIExploration.findUnique({
      where: { id: explorationId },
      select: {
        id: true,
        projectId: true,
        title: true,
        prompt: true,
        context: true,
        generationMode: true,
        aiModel: true,
        targetUrl: true,
        depth: true,
        authenticationRequired: true,
        generatePlaywright: true,
        generateGherkin: true,
        generateNegativeTests: true,
        status: true,
        generatedCount: true,
        fallbackUsed: true,
        lastError: true,
        generationDurationMs: true,
        promptTokens: true,
        completionTokens: true,
        lastGeneratedAt: true,
        createdAt: true,
        updatedAt: true,
        suggestions: {
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' },
          ],
          take: 20,
          select: {
            id: true,
            title: true,
            description: true,
            expectedResult: true,
            priority: true,
            status: true,
            sourcePageUrl: true,
            aiConfidence: true,
          },
        },
      },
    });
  }

  private normalize(value: string) {
    return ` ${value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()} `;
  }

  private hasAny(value: string, keywords: string[]) {
    return keywords.some((keyword) => value.includes(keyword));
  }
}
