import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { PlaywrightProcessService } from './playwright-process.service';
import { PlaywrightReportParserService } from './playwright-report-parser.service';
import type {
  TestExecutionReport,
  TestExecutionStep,
  TestFailureDetails,
} from './playwright-report.types';
import { PlaywrightSpecBuilderService } from './playwright-spec-builder.service';

export type PlaywrightRunOptions = {
  headed?: boolean;
  slowMo?: number;
  timeoutMs?: number;
};

export type PlaywrightRunResult =
  TestExecutionReport & {
    /**
     * Logs courts pour compatibilité avec l'interface actuelle.
     * Les logs Playwright complets sont conservés dans execution-report.txt
     * et artifacts.zip.
     */
    logs: string[];

    /**
     * Chemin serveur conservé pour compatibilité.
     */
    screenshotPath: string | null;
  };

@Injectable()
export class PlaywrightRunnerService {
  constructor(
    private readonly specBuilder: PlaywrightSpecBuilderService,
    private readonly processService: PlaywrightProcessService,
    private readonly reportParser: PlaywrightReportParserService,
  ) {}

  async runCode(
    automationCode: string,
    testCaseId?: string,
    options: PlaywrightRunOptions = {},
  ): Promise<PlaywrightRunResult> {
    const runId = `run_${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const headed = options.headed ?? false;

    const logs: string[] = [
      `Run ID: ${runId}`,
      `Mode: ${headed ? 'HEADED' : 'HEADLESS'}`,
      `Started at: ${startedAt}`,
    ];

    let runDirectory: string | null = null;

    try {
      const spec = this.specBuilder.build({
        automationCode,
        runId,
        testCaseId: testCaseId ?? null,
      });

      logs.push(
        spec.wrapped
          ? 'Playwright code wrapped in a generated test.'
          : 'Existing Playwright test detected.',
      );
      logs.push(`Generated spec: ${spec.fileName}`);

      const processResult =
        await this.processService.execute({
          runId,
          spec,
          headed,
          slowMo: options.slowMo,
          timeoutMs: options.timeoutMs,
        });

      runDirectory = processResult.runDirectory;

      const report =
        await this.reportParser.parse({
          processResult,
          testCaseId: testCaseId ?? null,
          headed,
        });

      logs.push(
        `Playwright exit code: ${String(
          processResult.exitCode,
        )}`,
      );
      logs.push(`Finished at: ${report.finishedAt}`);
      logs.push(`Final status: ${report.status}`);

      if (report.executionReportUrl) {
        logs.push(
          `Technical report: ${report.executionReportUrl}`,
        );
      }

      if (report.artifactsZipUrl) {
        logs.push(
          `Artifacts archive: ${report.artifactsZipUrl}`,
        );
      }

      return {
        ...report,
        logs,
        screenshotPath:
          this.resolveUploadPath(
            report.screenshotUrl,
          ),
      };
    } catch (error) {
      const finishedAt =
        new Date().toISOString();

      const durationMs =
        Date.now() - startedMs;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      logs.push(`Execution error: ${message}`);
      logs.push(`Finished at: ${finishedAt}`);
      logs.push('Final status: ERROR');

      const fallbackStep =
        this.buildFallbackErrorStep({
          startedAt,
          finishedAt,
          durationMs,
          message,
        });

      const failureDetails =
        this.buildFallbackFailureDetails(
          message,
        );

      return {
        runId,
        testCaseId: testCaseId ?? null,

        status: 'ERROR',
        browser: 'CHROMIUM',
        mode: headed
          ? 'HEADED'
          : 'HEADLESS',

        startedAt,
        finishedAt,
        failedAt: finishedAt,
        durationMs,

        summary: {
          total: 1,
          passed: 0,
          failed: 0,
          errors: 1,
          skipped: 0,
        },

        steps: [fallbackStep],
        failureDetails,

        error: message,

        screenshotUrl: null,
        traceUrl: null,
        artifactsZipUrl: null,
        executionReportUrl: null,

        screenshotPath: null,
        logs,
      };
    } finally {
      if (runDirectory) {
        await this.processService
          .cleanup(runDirectory)
          .catch(() => undefined);
      }
    }
  }

  private buildFallbackErrorStep(input: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    message: string;
  }): TestExecutionStep {
    return {
      order: 1,
      title:
        'Initialisation de l’exécution Playwright',
      status: 'ERROR',

      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      failedAt: input.finishedAt,
      durationMs: input.durationMs,

      expectedResult:
        'Le scénario Playwright doit être préparé et exécuté.',
      actualResult:
        'L’exécution n’a pas pu être terminée.',

      error: input.message,
      screenshotUrl: null,
    };
  }

  private buildFallbackFailureDetails(
    message: string,
  ): TestFailureDetails {
    return {
      sourceFile: null,
      sourceLine: null,
      sourceColumn: null,
      sourceSnippet: null,

      locator: null,

      expectedResult:
        'Le scénario Playwright doit être préparé et exécuté.',
      actualResult:
        'L’exécution n’a pas pu être terminée.',

      message,

      screenshotUrl: null,
      traceUrl: null,
      artifactsZipUrl: null,
      executionReportUrl: null,
    };
  }

  private resolveUploadPath(
    uploadUrl: string | null,
  ): string | null {
    if (
      !uploadUrl ||
      !uploadUrl.startsWith('/uploads/')
    ) {
      return null;
    }

    const relativeParts =
      uploadUrl
        .split('/')
        .filter(Boolean);

    return join(
      process.cwd(),
      ...relativeParts,
    );
  }
}
