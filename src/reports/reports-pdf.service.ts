import { Injectable } from '@nestjs/common';

type DistributionItem = {
  label: string;
  count: number;
};

type BugDetail = {
  id: string;
  title: string;
  status: string;
  severity: string;
  priority?: string | null;
  createdAt?: string | Date | null;
};

type BugReportPdfInput = {
  reportName: string;
  projectName: string;
  period: string;
  generatedAt: Date;
  generatedBy: string;
  includeCharts: boolean;
  includeDetails: boolean;
  summary: {
    total: number;
    open: number;
    resolved: number;
    critical: number;
    resolutionRate: number;
  };
  byStatus: DistributionItem[];
  bySeverity: DistributionItem[];
  byPriority: DistributionItem[];
  trend: Array<{ date: string; created: number }>;
  criticalBugs: BugDetail[];
};


type ExecutionFailureDetail = {
  id: string;
  testId: string;
  title: string;
  suite: string;
  mode: string;
  status: string;
  duration?: number | null;
  browser?: string | null;
  error?: string | null;
  executedAt?: string | Date | null;
};

type ExecutionReportPdfInput = {
  reportName: string;
  projectName: string;
  period: string;
  generatedAt: Date;
  generatedBy: string;
  includeCharts: boolean;
  includeDetails: boolean;
  includeLogs: boolean;
  summary: {
    total: number;
    success: number;
    failed: number;
    blocked: number;
    skipped: number;
    successRate: number;
  };
  testInventory: {
    total: number;
    manual: number;
    automated: number;
  };
  executionsByMode: {
    manual: number;
    automated: number;
  };
  trend: Array<{ date: string; executed: number }>;
  failedTests: ExecutionFailureDetail[];
  performance: {
    averageDurationMs: number;
    maxDurationMs: number;
  };
};


type QualityReportPdfInput = {
  reportName: string;
  projectName: string;
  period: string;
  generatedAt: Date;
  generatedBy: string;
  includeCharts: boolean;
  includeDetails: boolean;
  quality: {
    qualityScore: number | null;
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  qaHealth: {
    successRate: number;
    bugResolutionRate: number;
    automationRate: number;
  };
  operational: {
    totalTests: number;
    totalExecutions: number;
    openBugs: number;
    criticalBugs: number;
  };
  audit: {
    requestedUrl: string | null;
    finalUrl: string | null;
    lighthouseVersion: string | null;
    auditedAt: string | Date | null;
    auditsCount: number;
  };
};

type PdfLine = {
  kind: 'line';
  text: string;
  size?: number;
  bold?: boolean;
  gapBefore?: number;
  gapAfter?: number;
};

type PdfBarChart = {
  kind: 'barChart';
  title?: string;
  items: Array<{ label: string; value: number }>;
  height?: number;
  gapBefore?: number;
  gapAfter?: number;
};

type PdfGauge = {
  kind: 'gauge';
  title: string;
  value: number;
  lowLabel?: string;
  highLabel?: string;
  height?: number;
  gapBefore?: number;
  gapAfter?: number;
};

type PdfElement = PdfLine | PdfBarChart | PdfGauge;

@Injectable()
export class ReportsPdfService {
  buildBugReportPdf(input: BugReportPdfInput): Buffer {
    const elements: PdfElement[] = [];

    elements.push(
      this.line('SMART QA PLATFORM', 11, true),
      this.line('RAPPORT BUGS', 22, true, 6, 4),
      this.line(input.reportName, 14, true, 0, 12),
      this.line(`Projet : ${input.projectName}`),
      this.line(`Periode : ${input.period}`),
      this.line(`Genere le : ${this.formatDate(input.generatedAt)}`),
      this.line(`Genere par : ${input.generatedBy}`, 10, false, 0, 14),
      this.line('1. Resume', 15, true, 0, 7),
    );

    if (input.includeCharts) {
      elements.push({
        kind: 'barChart',
        items: [
          { label: 'Total bugs', value: input.summary.total },
          { label: 'Ouverts', value: input.summary.open },
          { label: 'Resolus', value: input.summary.resolved },
          { label: 'Critiques', value: input.summary.critical },
        ],
        height: 185,
        gapAfter: 10,
      });

      elements.push({
        kind: 'gauge',
        title: 'Taux de resolution',
        value: input.summary.resolutionRate,
        height: 130,
        gapAfter: 14,
      });
    } else {
      elements.push(
        this.line(`Total bugs : ${input.summary.total}`),
        this.line(`Bugs ouverts : ${input.summary.open}`),
        this.line(`Bugs resolus : ${input.summary.resolved}`),
        this.line(`Bugs critiques : ${input.summary.critical}`),
        this.line(`Taux de resolution : ${input.summary.resolutionRate}%`, 10, false, 0, 12),
      );
    }

    elements.push(this.line('2. Repartition par statut', 15, true, 0, 7));
    this.appendDistribution(elements, input.byStatus, 'Aucune donnee de statut pour la periode.');

    elements.push(this.line('3. Repartition par severite', 15, true, 0, 7));
    this.appendDistribution(elements, input.bySeverity, 'Aucune donnee de severite pour la periode.');

    elements.push(this.line('4. Repartition par priorite', 15, true, 0, 7));
    this.appendDistribution(elements, input.byPriority, 'Aucune donnee de priorite pour la periode.');

    if (input.includeCharts) {
      elements.push(this.line('5. Evolution des bugs crees', 15, true, 0, 7));

      if (input.trend.length === 0) {
        elements.push(this.line('Aucune evolution disponible pour la periode.', 10, false, 0, 8));
      } else {
        for (const point of input.trend) {
          const bar = '#'.repeat(Math.min(point.created, 30));
          elements.push(this.line(`${point.date}  ${String(point.created).padStart(3, ' ')}  ${bar}`));
        }
        elements.push(this.line('', 10, false, 0, 7));
      }
    }

    if (input.includeDetails) {
      elements.push(this.line('6. Bugs critiques / prioritaires', 15, true, 0, 7));

      if (input.criticalBugs.length === 0) {
        elements.push(this.line('Aucun bug critique dans la periode.', 10, false, 0, 8));
      } else {
        for (const bug of input.criticalBugs.slice(0, 15)) {
          const priority = bug.priority ? ` | ${this.humanize(bug.priority)}` : '';
          const date = bug.createdAt ? ` | ${this.formatDate(new Date(bug.createdAt))}` : '';
          elements.push(
            this.line(
              `${bug.id} | ${this.truncate(bug.title, 52)} | ${this.humanize(bug.severity)} | ${this.humanize(bug.status)}${priority}${date}`,
            ),
          );
        }
        elements.push(this.line('', 10, false, 0, 7));
      }
    }

    const conclusion = this.buildConclusion(input.summary);
    elements.push(
      this.line('7. Conclusion', 15, true, 0, 7),
      this.line(conclusion),
      this.line('', 10, false, 0, 8),
      this.line('Rapport genere automatiquement par SMART QA Platform.', 9),
    );

    return this.renderPdf(elements);
  }

  buildExecutionReportPdf(input: ExecutionReportPdfInput): Buffer {
    const elements: PdfElement[] = [];

    elements.push(
      this.line('SMART QA PLATFORM', 11, true),
      this.line('RAPPORT EXECUTION', 22, true, 6, 4),
      this.line(input.reportName, 14, true, 0, 12),
      this.line(`Projet : ${input.projectName}`),
      this.line(`Periode : ${input.period}`),
      this.line(`Genere le : ${this.formatDate(input.generatedAt)}`),
      this.line(`Genere par : ${input.generatedBy}`, 10, false, 0, 12),
      this.line('1. Resume des executions', 15, true, 0, 8),
    );

    if (input.includeCharts) {
      elements.push({
        kind: 'barChart',
        items: [
          { label: 'Total', value: input.summary.total },
          { label: 'Reussis', value: input.summary.success },
          { label: 'Echoues', value: input.summary.failed },
          { label: 'Bloques', value: input.summary.blocked },
          { label: 'Ignores', value: input.summary.skipped },
        ],
        height: 205,
        gapAfter: 4,
      });
    } else {
      elements.push(
        this.line(`Total executes : ${input.summary.total}`),
        this.line(`Reussis : ${input.summary.success}`),
        this.line(`Echoues : ${input.summary.failed}`),
        this.line(`Bloques : ${input.summary.blocked}`),
        this.line(`Ignores : ${input.summary.skipped}`, 10, false, 0, 8),
      );
    }

    elements.push({
      kind: 'gauge',
      title: 'Taux de reussite',
      value: input.summary.successRate,
      lowLabel: '0% = aucun test reussi',
      highLabel: '100% = tous les tests reussis',
      height: 145,
      gapAfter: 8,
    });

    elements.push(this.line('2. Tests du projet : manuel / automatise', 15, true, 0, 8));
    if (input.includeCharts) {
      elements.push({
        kind: 'barChart',
        items: [
          { label: 'Manuels', value: input.testInventory.manual },
          { label: 'Automatises', value: input.testInventory.automated },
        ],
        height: 175,
        gapAfter: 4,
      });
    }
    elements.push(
      this.line(`Total cas de test : ${input.testInventory.total}`),
      this.line(`Tests manuels : ${input.testInventory.manual}`),
      this.line(`Tests automatises : ${input.testInventory.automated}`, 10, false, 0, 8),
    );

    elements.push(this.line('3. Executions par mode', 15, true, 0, 8));
    if (input.includeCharts) {
      elements.push({
        kind: 'barChart',
        items: [
          { label: 'Manuel', value: input.executionsByMode.manual },
          { label: 'Automatique', value: input.executionsByMode.automated },
        ],
        height: 175,
        gapAfter: 4,
      });
    } else {
      elements.push(
        this.line(`Executions manuelles : ${input.executionsByMode.manual}`),
        this.line(`Executions automatisees : ${input.executionsByMode.automated}`, 10, false, 0, 8),
      );
    }

    elements.push(this.line('4. Evolution des executions', 15, true, 0, 7));
    if (input.trend.length === 0) {
      elements.push(this.line('Aucune execution terminee dans la periode.', 10, false, 0, 8));
    } else {
      for (const point of input.trend) {
        const bar = '#'.repeat(Math.min(point.executed, 30));
        elements.push(
          this.line(`${point.date}  ${String(point.executed).padStart(3, ' ')}  ${bar}`),
        );
      }
      elements.push(this.line('', 10, false, 0, 7));
    }

    if (input.includeDetails) {
      elements.push(this.line('5. Tests echoues', 15, true, 0, 7));
      if (input.failedTests.length === 0) {
        elements.push(this.line('Aucun test echoue dans la periode.', 10, false, 0, 8));
      } else {
        for (const test of input.failedTests.slice(0, 15)) {
          const date = test.executedAt
            ? this.formatDate(new Date(test.executedAt))
            : '-';
          const duration =
            typeof test.duration === 'number'
              ? this.formatDuration(test.duration)
              : '-';
          const browser = test.browser ? ` | ${test.browser}` : '';
          elements.push(
            this.line(
              `${this.truncate(test.title, 42)} | ${this.executionModeLabel(test.mode)} | ${duration}${browser} | ${date}`,
            ),
          );
          if (input.includeLogs && test.error) {
            elements.push(
              this.line(`  Erreur : ${this.truncate(test.error, 90)}`, 9),
            );
          }
        }
        elements.push(this.line('', 10, false, 0, 7));
      }
    }

    elements.push(
      this.line('6. Performance', 15, true, 0, 7),
      this.line(
        `Duree moyenne : ${this.formatDuration(input.performance.averageDurationMs)}`,
      ),
      this.line(
        `Duree maximale observee : ${this.formatDuration(input.performance.maxDurationMs)}`,
        10,
        false,
        0,
        8,
      ),
      this.line('7. Conclusion', 15, true, 0, 7),
      this.line(this.buildExecutionConclusion(input.summary, input.executionsByMode)),
      this.line('', 10, false, 0, 8),
      this.line('Rapport genere automatiquement par SMART QA Platform.', 9),
    );

    return this.renderPdf(elements);
  }

  buildQualityReportPdf(input: QualityReportPdfInput): Buffer {
    const elements: PdfElement[] = [];

    elements.push(
      this.line('SMART QA PLATFORM', 11, true),
      this.line('RAPPORT QUALITE', 22, true, 6, 4),
      this.line(input.reportName, 14, true, 0, 12),
      this.line(`Projet : ${input.projectName}`),
      this.line(`Periode QA : ${input.period}`),
      this.line(`Genere le : ${this.formatDate(input.generatedAt)}`),
      this.line(`Genere par : ${input.generatedBy}`, 10, false, 0, 12),
      this.line('1. Score qualite Lighthouse', 15, true, 0, 8),
    );

    if (input.quality.qualityScore === null) {
      elements.push(
        this.line(
          'Aucun audit Lighthouse n est disponible pour le perimetre selectionne.',
          10,
          false,
          0,
          10,
        ),
      );
    } else {
      elements.push({
        kind: 'gauge',
        title: 'Score qualite',
        value: input.quality.qualityScore,
        lowLabel: '0% = qualite faible',
        highLabel: '100% = qualite optimale',
        height: 145,
        gapAfter: 8,
      });
    }

    elements.push(this.line('2. Scores Lighthouse', 15, true, 0, 8));
    const lighthouseItems = [
      { label: 'Performance', value: input.quality.performance },
      { label: 'Access.', value: input.quality.accessibility },
      { label: 'Bonnes prat.', value: input.quality.bestPractices },
      { label: 'SEO', value: input.quality.seo },
    ].filter((item): item is { label: string; value: number } => typeof item.value === 'number');

    if (input.includeCharts && lighthouseItems.length > 0) {
      elements.push({
        kind: 'barChart',
        items: lighthouseItems,
        height: 195,
        gapAfter: 8,
      });
    } else if (lighthouseItems.length > 0) {
      for (const item of lighthouseItems) {
        elements.push(this.line(`${item.label} : ${item.value}%`));
      }
      elements.push(this.line('', 10, false, 0, 8));
    } else {
      elements.push(this.line('Aucun score Lighthouse disponible.', 10, false, 0, 8));
    }

    elements.push(this.line('3. Sante QA sur la periode', 15, true, 0, 8));
    if (input.includeCharts) {
      elements.push({
        kind: 'barChart',
        items: [
          { label: 'Reussite', value: input.qaHealth.successRate },
          { label: 'Resolution', value: input.qaHealth.bugResolutionRate },
          { label: 'Auto', value: input.qaHealth.automationRate },
        ],
        height: 185,
        gapAfter: 6,
      });
    }
    elements.push(
      this.line(`Taux de reussite des tests : ${input.qaHealth.successRate}%`),
      this.line(`Taux de resolution des bugs : ${input.qaHealth.bugResolutionRate}%`),
      this.line(`Taux d automatisation : ${input.qaHealth.automationRate}%`, 10, false, 0, 8),
    );

    elements.push(
      this.line('4. Indicateurs operationnels', 15, true, 0, 8),
      this.line(`Cas de test : ${input.operational.totalTests}`),
      this.line(`Executions terminees : ${input.operational.totalExecutions}`),
      this.line(`Bugs ouverts : ${input.operational.openBugs}`),
      this.line(`Bugs critiques : ${input.operational.criticalBugs}`, 10, false, 0, 8),
    );

    if (input.includeDetails) {
      elements.push(this.line('5. Audit Lighthouse utilise', 15, true, 0, 8));
      if (!input.audit.auditedAt) {
        elements.push(this.line('Aucun audit Lighthouse sauvegarde.', 10, false, 0, 8));
      } else {
        elements.push(
          this.line(`URL : ${this.truncate(input.audit.finalUrl || input.audit.requestedUrl || '-', 80)}`),
          this.line(`Date audit : ${this.formatDate(new Date(input.audit.auditedAt))}`),
          this.line(`Version Lighthouse : ${input.audit.lighthouseVersion || '-'}`),
          this.line(`Audits pris en compte : ${input.audit.auditsCount}`, 10, false, 0, 8),
        );
      }
    }

    elements.push(
      this.line('6. Conclusion', 15, true, 0, 8),
      this.line(this.buildQualityConclusion(input)),
      this.line('', 10, false, 0, 8),
      this.line('Rapport genere automatiquement par SMART QA Platform.', 9),
    );

    return this.renderPdf(elements);
  }

  private buildQualityConclusion(input: QualityReportPdfInput) {
    const score = input.quality.qualityScore;

    if (score === null) {
      return `Aucun score Lighthouse. Reussite tests : ${input.qaHealth.successRate}%. Resolution bugs : ${input.qaHealth.bugResolutionRate}%.`;
    }

    if (score >= 90) {
      return `Score Lighthouse : ${score}%. Qualite technique elevee. Reussite tests : ${input.qaHealth.successRate}%. Resolution bugs : ${input.qaHealth.bugResolutionRate}%.`;
    }

    if (score >= 50) {
      return `Score Lighthouse : ${score}%. Qualite acceptable, avec des axes a ameliorer. Reussite tests : ${input.qaHealth.successRate}%.`;
    }

    return `Score Lighthouse : ${score}%. Amelioration prioritaire recommandee. Reussite tests : ${input.qaHealth.successRate}%. Bugs critiques : ${input.operational.criticalBugs}.`;
  }

  private buildExecutionConclusion(
    summary: ExecutionReportPdfInput['summary'],
    modes: ExecutionReportPdfInput['executionsByMode'],
  ) {
    if (summary.total === 0) {
      return 'Aucune execution terminee n a ete enregistree pour le projet et la periode selectionnes.';
    }

    if (summary.failed > 0 || summary.blocked > 0) {
      return `Reussite : ${summary.successRate}%. Echecs : ${summary.failed}. Bloques : ${summary.blocked}. Modes : ${modes.manual} manuel(s), ${modes.automated} automatise(s).`;
    }

    return `Reussite : ${summary.successRate}%. Aucun echec ni blocage. Modes : ${modes.manual} manuel(s), ${modes.automated} automatise(s).`;
  }

  private formatDuration(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '0 ms';
    if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes} min ${remainingSeconds} s`;
  }

  private appendDistribution(
    elements: PdfElement[],
    items: DistributionItem[],
    emptyMessage: string,
  ) {
    if (items.length === 0) {
      elements.push(this.line(emptyMessage, 10, false, 0, 8));
      return;
    }

    for (const item of items) {
      elements.push(this.line(`${this.humanize(item.label)} : ${item.count}`));
    }
    elements.push(this.line('', 10, false, 0, 7));
  }

  private line(
    text: string,
    size = 10,
    bold = false,
    gapBefore = 0,
    gapAfter = 0,
  ): PdfLine {
    return { kind: 'line', text, size, bold, gapBefore, gapAfter };
  }

  private buildConclusion(summary: BugReportPdfInput['summary']) {
    if (summary.total === 0) {
      return 'Aucun bug n a ete enregistre pour le projet et la periode selectionnes.';
    }

    if (summary.critical > 0) {
      return `La periode contient ${summary.critical} bug(s) critique(s). Leur traitement doit rester prioritaire. Le taux de resolution est de ${summary.resolutionRate}%.`;
    }

    if (summary.open > summary.resolved) {
      return `Le volume de bugs ouverts reste superieur au volume resolu. Le taux de resolution est de ${summary.resolutionRate}%. Une surveillance du backlog est recommandee.`;
    }

    return `La situation des anomalies est globalement maitrisee sur la periode. Le taux de resolution est de ${summary.resolutionRate}% et aucun bug critique n est signale.`;
  }

  private renderPdf(elements: PdfElement[]): Buffer {
    const pageWidth = 595;
    const pageHeight = 842;
    const marginX = 48;
    const topY = 792;
    const bottomY = 35;

    const pages: PdfElement[][] = [];
    let current: PdfElement[] = [];
    let y = topY;

    for (const element of elements) {
      const needed = this.measureElement(element);
      if (y - needed < bottomY && current.length > 0) {
        pages.push(current);
        current = [];
        y = topY;
      }
      current.push(element);
      y -= needed;
    }
    if (current.length > 0) pages.push(current);

    const objects: string[] = [];
    const fontRegularObj = 3;
    const fontBoldObj = 4;
    const firstPageObj = 5;

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const kids: string[] = [];
    pages.forEach((_, index) => kids.push(`${firstPageObj + index * 2} 0 R`));
    objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
    objects[fontRegularObj] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[fontBoldObj] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

    pages.forEach((pageElements, index) => {
      const pageObj = firstPageObj + index * 2;
      const contentObj = pageObj + 1;
      let cursorY = topY;
      const commands: string[] = [];

      for (const element of pageElements) {
        if (element.kind === 'line') {
          cursorY = this.renderLine(commands, element, marginX, cursorY);
        } else if (element.kind === 'barChart') {
          cursorY = this.renderBarChart(commands, element, marginX, cursorY);
        } else {
          cursorY = this.renderGauge(commands, element, marginX, cursorY);
        }
      }

      commands.push(
        '0.45 0.45 0.45 rg',
        'BT',
        '/F1 8 Tf',
        `1 0 0 1 ${pageWidth - 105} 16 Tm`,
        `(Page ${index + 1} / ${pages.length}) Tj`,
        'ET',
        '0 0 0 rg',
      );

      const stream = commands.join('\n');
      objects[pageObj] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
      objects[contentObj] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
    });

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = Buffer.byteLength(pdf, 'ascii');
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }

  private measureElement(element: PdfElement) {
    if (element.kind === 'line') {
      const size = element.size ?? 10;
      return (element.gapBefore ?? 0) + Math.max(15, size + 4) + (element.gapAfter ?? 0);
    }
    return (element.gapBefore ?? 0) + (element.height ?? 150) + (element.gapAfter ?? 0);
  }

  private renderLine(commands: string[], line: PdfLine, x: number, y: number) {
    const size = line.size ?? 10;
    const lineHeight = Math.max(15, size + 4);
    let cursorY = y - (line.gapBefore ?? 0);

    if (line.text) {
      const font = line.bold ? 'F2' : 'F1';
      commands.push(
        '0 0 0 rg',
        'BT',
        `/${font} ${size} Tf`,
        `1 0 0 1 ${x} ${cursorY} Tm`,
        `(${this.pdfEscape(line.text)}) Tj`,
        'ET',
      );
    }
    cursorY -= lineHeight + (line.gapAfter ?? 0);
    return cursorY;
  }

  private renderBarChart(commands: string[], chart: PdfBarChart, x: number, y: number) {
    const height = chart.height ?? 185;
    let top = y - (chart.gapBefore ?? 0);
    const chartLeft = x + 25;
    const chartBottom = top - height + 34;
    const chartHeight = height - 58;
    const chartWidth = 390;
    const maxValue = Math.max(1, ...chart.items.map((item) => item.value));
    const barWidth = 54;
    const gap = (chartWidth - barWidth * chart.items.length) / Math.max(1, chart.items.length - 1);

    if (chart.title) {
      commands.push('BT', '/F2 10 Tf', `1 0 0 1 ${x} ${top} Tm`, `(${this.pdfEscape(chart.title)}) Tj`, 'ET');
      top -= 15;
    }

    // grille et axe vertical
    commands.push('0.88 0.88 0.88 RG', '0.5 w');
    for (let i = 0; i <= 4; i += 1) {
      const gy = chartBottom + (chartHeight * i) / 4;
      commands.push(`${chartLeft} ${gy.toFixed(2)} m ${chartLeft + chartWidth} ${gy.toFixed(2)} l S`);
      const tick = Math.round((maxValue * i) / 4);
      commands.push(
        '0.4 0.4 0.4 rg',
        'BT',
        '/F1 7 Tf',
        `1 0 0 1 ${chartLeft - 20} ${gy - 2} Tm`,
        `(${tick}) Tj`,
        'ET',
      );
    }

    // barres
    chart.items.forEach((item, index) => {
      const bx = chartLeft + index * (barWidth + gap);
      const bh = item.value === 0 ? 0 : Math.max(2, (item.value / maxValue) * chartHeight);
      commands.push('0.15 0.50 0.92 rg', `${bx.toFixed(2)} ${chartBottom.toFixed(2)} ${barWidth} ${bh.toFixed(2)} re f`);

      commands.push(
        '0.1 0.1 0.1 rg',
        'BT',
        '/F2 9 Tf',
        `1 0 0 1 ${(bx + barWidth / 2 - 3).toFixed(2)} ${(chartBottom + bh + 7).toFixed(2)} Tm`,
        `(${item.value}) Tj`,
        'ET',
        'BT',
        '/F1 8 Tf',
        `1 0 0 1 ${(bx + 2).toFixed(2)} ${(chartBottom - 14).toFixed(2)} Tm`,
        `(${this.pdfEscape(this.truncate(item.label, 12))}) Tj`,
        'ET',
      );
    });

    return y - (chart.gapBefore ?? 0) - height - (chart.gapAfter ?? 0);
  }

  private renderGauge(commands: string[], gauge: PdfGauge, x: number, y: number) {
    const height = gauge.height ?? 130;
    const top = y - (gauge.gapBefore ?? 0);
    const value = Math.max(0, Math.min(100, Number.isFinite(gauge.value) ? gauge.value : 0));
    const cx = x + 80;
    const cy = top - 70;
    const radius = 43;

    commands.push(
      '0.1 0.1 0.1 rg',
      'BT',
      '/F2 11 Tf',
      `1 0 0 1 ${x} ${top - 5} Tm`,
      `(${this.pdfEscape(gauge.title)}) Tj`,
      'ET',
    );

    // anneau de fond
    commands.push('0.88 0.88 0.88 RG', '8 w');
    commands.push(...this.circleStrokeCommands(cx, cy, radius));

    // progression, depart a 12h et progression horaire
    if (value > 0) {
      commands.push('0.15 0.50 0.92 RG', '8 w', '1 J');
      commands.push(...this.arcStrokeCommands(cx, cy, radius, 90, 90 - 360 * (value / 100)));
      commands.push('0 J');
    }

    commands.push(
      '0.05 0.05 0.05 rg',
      'BT',
      '/F2 18 Tf',
      `1 0 0 1 ${cx - 17} ${cy - 6} Tm`,
      `(${Math.round(value)}%) Tj`,
      'ET',
      '0.45 0.45 0.45 rg',
      'BT',
      '/F1 8 Tf',
      `1 0 0 1 ${x + 150} ${cy + 8} Tm`,
      `(${this.pdfEscape(gauge.lowLabel || '0% = non resolu')}) Tj`,
      'ET',
      'BT',
      '/F1 8 Tf',
      `1 0 0 1 ${x + 150} ${cy - 8} Tm`,
      `(${this.pdfEscape(gauge.highLabel || '100% = totalement resolu')}) Tj`,
      'ET',
    );

    return y - (gauge.gapBefore ?? 0) - height - (gauge.gapAfter ?? 0);
  }

  private circleStrokeCommands(cx: number, cy: number, radius: number) {
    const k = 0.5522847498;
    const c = radius * k;
    return [
      `${cx + radius} ${cy} m`,
      `${cx + radius} ${cy + c} ${cx + c} ${cy + radius} ${cx} ${cy + radius} c`,
      `${cx - c} ${cy + radius} ${cx - radius} ${cy + c} ${cx - radius} ${cy} c`,
      `${cx - radius} ${cy - c} ${cx - c} ${cy - radius} ${cx} ${cy - radius} c`,
      `${cx + c} ${cy - radius} ${cx + radius} ${cy - c} ${cx + radius} ${cy} c`,
      'S',
    ];
  }

  private arcStrokeCommands(
    cx: number,
    cy: number,
    radius: number,
    startDeg: number,
    endDeg: number,
  ) {
    const commands: string[] = [];
    const total = endDeg - startDeg;
    const steps = Math.max(2, Math.ceil(Math.abs(total) / 8));
    for (let i = 0; i <= steps; i += 1) {
      const angle = (startDeg + (total * i) / steps) * (Math.PI / 180);
      const px = cx + radius * Math.cos(angle);
      const py = cy + radius * Math.sin(angle);
      commands.push(`${px.toFixed(2)} ${py.toFixed(2)} ${i === 0 ? 'm' : 'l'}`);
    }
    commands.push('S');
    return commands;
  }

  private pdfEscape(value: string) {
    return this.toAscii(value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private toAscii(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^\x20-\x7E]/g, ' ');
  }

  private executionModeLabel(value: string) {
    if (value === 'AUTOMATED') return 'Automatise';
    if (value === 'MANUAL') return 'Manuel';
    return this.humanize(value);
  }

  private humanize(value: string) {
    return value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

  private truncate(value: string, max: number) {
    return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
  }

  private formatDate(date: Date) {
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
