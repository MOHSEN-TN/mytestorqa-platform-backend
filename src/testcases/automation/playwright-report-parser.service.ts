import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  extname,
  join,
} from 'node:path';

import type { PlaywrightProcessResult } from './playwright-process.service';
import type {
  TestExecutionReport,
  TestExecutionStatus,
  TestExecutionStep,
  TestFailureDetails,
} from './playwright-report.types';

type ParsePlaywrightReportInput = {
  processResult: PlaywrightProcessResult;
  testCaseId?: string | null;
  headed?: boolean;
};

type JsonReporterLocation = {
  file?: string;
  line?: number;
  column?: number;
};

type JsonReporterAttachment = {
  name?: string;
  contentType?: string;
  path?: string;
};

type JsonReporterError = {
  message?: string;
  stack?: string;
  value?: string;
  snippet?: string;
  location?: JsonReporterLocation;
};

type JsonReporterStep = {
  title?: string;
  duration?: number;
  error?: JsonReporterError;
  steps?: JsonReporterStep[];
};

type JsonReporterResult = {
  status?: string;
  startTime?: string;
  duration?: number;
  error?: JsonReporterError;
  errors?: JsonReporterError[];
  steps?: JsonReporterStep[];
  attachments?: JsonReporterAttachment[];
  stdout?: unknown[];
  stderr?: unknown[];
};

type JsonReporterTest = {
  title?: string;
  expectedStatus?: string;
  status?: string;
  results?: JsonReporterResult[];
};

type JsonReporterSpec = {
  title?: string;
  file?: string;
  tests?: JsonReporterTest[];
};

type JsonReporterSuite = {
  title?: string;
  file?: string;
  specs?: JsonReporterSpec[];
  suites?: JsonReporterSuite[];
};

type JsonReporterRoot = {
  suites?: JsonReporterSuite[];
  errors?: JsonReporterError[];
};

type CopiedFile = {
  path: string;
  url: string;
};

type PersistedArtifacts = {
  directoryPath: string;
  screenshotUrl: string | null;
  screenshotPath: string | null;
  traceUrl: string | null;
  tracePath: string | null;
  executionReportUrl: string | null;
  executionReportPath: string | null;
  artifactsZipUrl: string | null;
  artifactsZipPath: string | null;
};

type FailureComparison = {
  locator: string | null;
  expectedResult: string | null;
  actualResult: string | null;
};

@Injectable()
export class PlaywrightReportParserService {
  private readonly uploadsRoot = join(
    process.cwd(),
    'uploads',
    'automation-runs',
  );

  async parse(
    input: ParsePlaywrightReportInput,
  ): Promise<TestExecutionReport> {
    const nativeReport = await this.readNativeReport(
      input.processResult.reportFilePath,
    );

    const tests = this.collectTests(
      nativeReport.suites ?? [],
    );

    const status = this.resolveGlobalStatus(
      tests,
      nativeReport,
      input.processResult,
    );

    const errorObject = this.findFirstError(
      tests,
      nativeReport,
    );

    const error = this.resolveGlobalError(
      tests,
      nativeReport,
      input.processResult,
    );

    const artifacts = await this.persistArtifacts({
      tests,
      processResult: input.processResult,
      status,
      error,
    });

    const steps = this.buildSteps(
      tests,
      input.processResult,
      artifacts.screenshotUrl,
    );

    const startedAt =
      this.findFirstStartedAt(tests) ??
      input.processResult.startedAt;

    const finishedAt =
      this.findLastFinishedAt(tests) ??
      input.processResult.finishedAt;

    const failedAt =
      status === 'FAILED' || status === 'ERROR'
        ? this.findFailureDate(steps) ?? finishedAt
        : null;

    const failureDetails =
      status === 'PASSED'
        ? null
        : await this.buildFailureDetails({
            errorObject,
            error,
            processResult: input.processResult,
            artifacts,
          });

    return {
      runId: input.processResult.runId,
      testCaseId: input.testCaseId ?? null,

      status,
      browser: 'CHROMIUM',
      mode: input.headed ? 'HEADED' : 'HEADLESS',

      startedAt,
      finishedAt,
      failedAt,
      durationMs: input.processResult.durationMs,

      summary: this.buildSummary(steps),
      steps,
      failureDetails,

      error,
      screenshotUrl: artifacts.screenshotUrl,
      traceUrl: artifacts.traceUrl,
      artifactsZipUrl: artifacts.artifactsZipUrl,
      executionReportUrl:
        artifacts.executionReportUrl,
    };
  }

  private async readNativeReport(
    reportFilePath: string,
  ): Promise<JsonReporterRoot> {
    try {
      const raw = await readFile(
        reportFilePath,
        'utf8',
      );
      const parsed: unknown = JSON.parse(raw);

      if (!this.isRecord(parsed)) {
        throw new Error(
          'Le contenu du rapport Playwright est invalide',
        );
      }

      return parsed as JsonReporterRoot;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Impossible de lire le rapport Playwright : ${message}`,
      );
    }
  }

  private collectTests(
    suites: JsonReporterSuite[],
  ): JsonReporterTest[] {
    const tests: JsonReporterTest[] = [];

    const visitSuite = (
      suite: JsonReporterSuite,
    ): void => {
      for (const spec of suite.specs ?? []) {
        tests.push(...(spec.tests ?? []));
      }

      for (const childSuite of suite.suites ?? []) {
        visitSuite(childSuite);
      }
    };

    for (const suite of suites) {
      visitSuite(suite);
    }

    return tests;
  }

  private buildSteps(
    tests: JsonReporterTest[],
    processResult: PlaywrightProcessResult,
    failureScreenshotUrl: string | null,
  ): TestExecutionStep[] {
    const steps: TestExecutionStep[] = [];
    let order = 1;
    let screenshotAssigned = false;

    for (const test of tests) {
      const results = test.results ?? [];

      if (results.length === 0) {
        const fallback = this.createFallbackTestStep({
          order,
          test,
          processResult,
        });

        if (
          !screenshotAssigned &&
          fallback.status !== 'PASSED'
        ) {
          fallback.screenshotUrl =
            failureScreenshotUrl;
          screenshotAssigned = true;
        }

        steps.push(fallback);
        order += 1;
        continue;
      }

      for (const result of results) {
        const resultSteps = result.steps ?? [];

        if (resultSteps.length === 0) {
          const fallback =
            this.createResultFallbackStep({
              order,
              test,
              result,
              processResult,
            });

          if (
            !screenshotAssigned &&
            fallback.status !== 'PASSED'
          ) {
            fallback.screenshotUrl =
              failureScreenshotUrl;
            screenshotAssigned = true;
          }

          steps.push(fallback);
          order += 1;
          continue;
        }

        for (const nativeStep of this.flattenSteps(
          resultSteps,
        )) {
          const stepStatus =
            this.resolveStepStatus(
              nativeStep,
              result,
            );

          const startedAt =
            this.parseIsoDate(
              result.startTime,
            ) ?? processResult.startedAt;

          const durationMs =
            this.normalizeDuration(
              nativeStep.duration,
            );

          const finishedAt =
            this.addMilliseconds(
              startedAt,
              durationMs,
            );

          const isFailure =
            stepStatus === 'FAILED' ||
            stepStatus === 'ERROR';

          steps.push({
            order,
            title:
              nativeStep.title?.trim() ||
              `Étape ${order}`,
            status: stepStatus,

            startedAt,
            finishedAt,
            failedAt: isFailure
              ? finishedAt
              : null,
            durationMs,

            expectedResult:
              'L’étape doit être exécutée sans erreur.',
            actualResult:
              this.buildActualResult(
                stepStatus,
                nativeStep.title,
              ),

            error: this.extractError(
              nativeStep.error,
            ),
            screenshotUrl:
              isFailure &&
              !screenshotAssigned
                ? failureScreenshotUrl
                : null,
          });

          if (
            isFailure &&
            !screenshotAssigned
          ) {
            screenshotAssigned = true;
          }

          order += 1;
        }
      }
    }

    if (steps.length === 0) {
      const status: TestExecutionStatus =
        processResult.exitCode === 0
          ? 'PASSED'
          : processResult.timedOut
            ? 'ERROR'
            : 'FAILED';

      steps.push({
        order: 1,
        title: 'Exécution Playwright',
        status,

        startedAt: processResult.startedAt,
        finishedAt:
          processResult.finishedAt,
        failedAt:
          status === 'PASSED'
            ? null
            : processResult.finishedAt,
        durationMs:
          processResult.durationMs,

        expectedResult:
          'Le scénario doit être exécuté avec succès.',
        actualResult:
          status === 'PASSED'
            ? 'Le scénario a été exécuté avec succès.'
            : 'Le scénario ne s’est pas terminé correctement.',

        error: processResult.timedOut
          ? 'Le délai maximal d’exécution a été dépassé.'
          : processResult.exitCode === 0
            ? null
            : `Playwright Test a terminé avec le code ${String(
                processResult.exitCode,
              )}.`,
        screenshotUrl:
          status === 'PASSED'
            ? null
            : failureScreenshotUrl,
      });
    }

    return steps;
  }

  private flattenSteps(
    steps: JsonReporterStep[],
  ): JsonReporterStep[] {
    const flattened: JsonReporterStep[] = [];

    const visit = (
      step: JsonReporterStep,
    ): void => {
      flattened.push(step);

      for (const child of step.steps ?? []) {
        visit(child);
      }
    };

    for (const step of steps) {
      visit(step);
    }

    return flattened;
  }

  private resolveStepStatus(
    step: JsonReporterStep,
    result: JsonReporterResult,
  ): TestExecutionStatus {
    if (step.error) {
      return 'FAILED';
    }

    const resultStatus =
      this.normalizeNativeStatus(
        result.status,
      );

    if (resultStatus === 'SKIPPED') {
      return 'SKIPPED';
    }

    if (resultStatus === 'ERROR') {
      return 'ERROR';
    }

    return 'PASSED';
  }

  private createFallbackTestStep(input: {
    order: number;
    test: JsonReporterTest;
    processResult: PlaywrightProcessResult;
  }): TestExecutionStep {
    const status =
      this.normalizeNativeStatus(
        input.test.status,
      ) ??
      (input.processResult.exitCode === 0
        ? 'PASSED'
        : 'FAILED');

    return {
      order: input.order,
      title:
        input.test.title?.trim() ||
        `Test ${input.order}`,
      status,

      startedAt:
        input.processResult.startedAt,
      finishedAt:
        input.processResult.finishedAt,
      failedAt:
        status === 'FAILED' ||
        status === 'ERROR'
          ? input.processResult.finishedAt
          : null,
      durationMs:
        input.processResult.durationMs,

      expectedResult:
        'Le test doit être exécuté avec succès.',
      actualResult:
        this.buildActualResult(
          status,
          input.test.title,
        ),

      error: null,
      screenshotUrl: null,
    };
  }

  private createResultFallbackStep(input: {
    order: number;
    test: JsonReporterTest;
    result: JsonReporterResult;
    processResult: PlaywrightProcessResult;
  }): TestExecutionStep {
    const status =
      this.normalizeNativeStatus(
        input.result.status,
      ) ?? 'ERROR';

    const startedAt =
      this.parseIsoDate(
        input.result.startTime,
      ) ?? input.processResult.startedAt;

    const durationMs =
      this.normalizeDuration(
        input.result.duration,
      );

    const finishedAt =
      this.addMilliseconds(
        startedAt,
        durationMs,
      );

    return {
      order: input.order,
      title:
        input.test.title?.trim() ||
        `Test ${input.order}`,
      status,

      startedAt,
      finishedAt,
      failedAt:
        status === 'FAILED' ||
        status === 'ERROR'
          ? finishedAt
          : null,
      durationMs,

      expectedResult:
        'Le test doit être exécuté avec succès.',
      actualResult:
        this.buildActualResult(
          status,
          input.test.title,
        ),

      error:
        this.extractResultError(
          input.result,
        ),
      screenshotUrl: null,
    };
  }

  private resolveGlobalStatus(
    tests: JsonReporterTest[],
    report: JsonReporterRoot,
    processResult: PlaywrightProcessResult,
  ): Exclude<
    TestExecutionStatus,
    'SKIPPED'
  > {
    if (processResult.timedOut) {
      return 'ERROR';
    }

    if ((report.errors ?? []).length > 0) {
      return 'ERROR';
    }

    const statuses = tests.flatMap(
      (test) =>
        (test.results ?? []).map(
          (result) =>
            this.normalizeNativeStatus(
              result.status,
            ),
        ),
    );

    if (statuses.includes('ERROR')) {
      return 'ERROR';
    }

    if (
      statuses.includes('FAILED') ||
      processResult.exitCode !== 0
    ) {
      return 'FAILED';
    }

    return 'PASSED';
  }

  private findFirstError(
    tests: JsonReporterTest[],
    report: JsonReporterRoot,
  ): JsonReporterError | null {
    const rootError =
      (report.errors ?? []).find(Boolean);

    if (rootError) {
      return rootError;
    }

    for (const test of tests) {
      for (const result of test.results ?? []) {
        if (result.error) {
          return result.error;
        }

        const resultError =
          (result.errors ?? []).find(Boolean);

        if (resultError) {
          return resultError;
        }

        const stepError =
          this.findStepError(
            result.steps ?? [],
          );

        if (stepError) {
          return stepError;
        }
      }
    }

    return null;
  }

  private findStepError(
    steps: JsonReporterStep[],
  ): JsonReporterError | null {
    for (const step of steps) {
      if (step.error) {
        return step.error;
      }

      const childError =
        this.findStepError(
          step.steps ?? [],
        );

      if (childError) {
        return childError;
      }
    }

    return null;
  }

  private resolveGlobalError(
    tests: JsonReporterTest[],
    report: JsonReporterRoot,
    processResult: PlaywrightProcessResult,
  ): string | null {
    const firstError =
      this.findFirstError(
        tests,
        report,
      );

    const extracted =
      this.extractError(firstError ?? undefined);

    if (extracted) {
      return extracted;
    }

    if (processResult.timedOut) {
      return 'Le délai maximal d’exécution Playwright a été dépassé.';
    }

    if (
      processResult.exitCode !== 0 &&
      processResult.exitCode !== null
    ) {
      return `Playwright Test a terminé avec le code ${processResult.exitCode}.`;
    }

    if (processResult.signal) {
      return `Le processus Playwright a été interrompu par le signal ${processResult.signal}.`;
    }

    return null;
  }

  private extractResultError(
    result: JsonReporterResult,
  ): string | null {
    const directError =
      this.extractError(result.error);

    if (directError) {
      return directError;
    }

    return (
      (result.errors ?? [])
        .map((error) =>
          this.extractError(error),
        )
        .find(
          (message): message is string =>
            Boolean(message),
        ) ?? null
    );
  }

  private extractError(
    error: JsonReporterError | undefined,
  ): string | null {
    if (!error) {
      return null;
    }

    const value =
      error.message?.trim() ||
      error.value?.trim() ||
      error.stack?.trim();

    return value
      ? this.stripAnsi(value)
      : null;
  }

  private async buildFailureDetails(input: {
    errorObject: JsonReporterError | null;
    error: string | null;
    processResult: PlaywrightProcessResult;
    artifacts: PersistedArtifacts;
  }): Promise<TestFailureDetails> {
    const stdout = await this.readOptionalFile(
      input.processResult.stdoutFilePath,
    );

    const stderr = await this.readOptionalFile(
      input.processResult.stderrFilePath,
    );

    const completeTechnicalText = [
      input.error ?? '',
      stdout,
      stderr,
    ]
      .filter(Boolean)
      .join('\n');

    const source = await this.resolveSourceLocation({
      errorObject: input.errorObject,
      errorText: completeTechnicalText,
      specFilePath:
        input.processResult.specFilePath,
    });

    const comparison =
      this.extractFailureComparison(
        input.error ?? completeTechnicalText,
      );

    const expectedResult =
      comparison.expectedResult ??
      this.extractExpectedFromSnippet(
        source.sourceSnippet,
      );

    return {
      sourceFile: source.sourceFile,
      sourceLine: source.sourceLine,
      sourceColumn: source.sourceColumn,
      sourceSnippet: source.sourceSnippet,

      locator: comparison.locator,

      expectedResult,
      actualResult:
        comparison.actualResult,

      message: this.buildShortMessage(
        input.error,
      ),

      screenshotUrl:
        input.artifacts.screenshotUrl,
      traceUrl: input.artifacts.traceUrl,
      artifactsZipUrl:
        input.artifacts.artifactsZipUrl,
      executionReportUrl:
        input.artifacts.executionReportUrl,
    };
  }

  private async resolveSourceLocation(input: {
    errorObject: JsonReporterError | null;
    errorText: string | null;
    specFilePath: string;
  }): Promise<{
    sourceFile: string | null;
    sourceLine: number | null;
    sourceColumn: number | null;
    sourceSnippet: string | null;
  }> {
    const location =
      input.errorObject?.location;

    const stackLocation =
      this.extractStackLocation(
        input.errorText ?? '',
      );

    const generatedLine =
      location?.line ??
      stackLocation?.line ??
      null;

    const generatedColumn =
      location?.column ??
      stackLocation?.column ??
      null;

    const generatedFile =
      location?.file ??
      stackLocation?.file ??
      input.specFilePath;

    const sourceFile =
      generatedFile
        ? basename(generatedFile)
        : null;

    if (!generatedLine) {
      return {
        sourceFile,
        sourceLine: null,
        sourceColumn:
          generatedColumn,
        sourceSnippet:
          input.errorObject?.snippet
            ? this.stripAnsi(
                input.errorObject.snippet,
              )
            : null,
      };
    }

    const sourceCode = await this.readOptionalFile(
      input.specFilePath,
    );

    const offset =
      this.detectGeneratedLineOffset(
        sourceCode,
      );

    const sourceLine = Math.max(
      1,
      generatedLine - offset,
    );

    const sourceSnippet =
      this.buildSourceSnippet({
        sourceCode,
        sourceLine,
        sourceColumn:
          generatedColumn,
        offset,
      }) ??
      (input.errorObject?.snippet
        ? this.stripAnsi(
            input.errorObject.snippet,
          )
        : null);

    return {
      sourceFile,
      sourceLine,
      sourceColumn:
        generatedColumn,
      sourceSnippet,
    };
  }

  private extractStackLocation(
    errorText: string,
  ): {
    file: string;
    line: number;
    column: number;
  } | null {
    const clean =
      this.stripAnsi(errorText);

    const matches = [
      ...clean.matchAll(
        /at\s+(.+?\.spec\.[cm]?[jt]s):(\d+):(\d+)/g,
      ),
    ];

    const match = matches.at(-1);

    if (!match) {
      return null;
    }

    return {
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
    };
  }

  private detectGeneratedLineOffset(
    sourceCode: string,
  ): number {
    if (!sourceCode) {
      return 0;
    }

    const lines = sourceCode.split(/\r?\n/);

    const hasMetadataHeader =
      lines[0]?.startsWith(
        '// Generated by MyTester',
      ) &&
      lines[1]?.startsWith('// Run ID:') &&
      lines[2]?.startsWith(
        '// Test case ID:',
      ) &&
      lines[3]?.startsWith(
        '// Generated at:',
      );

    if (!hasMetadataHeader) {
      return 0;
    }

    const isWrappedScenario =
      lines.some((line) =>
        line.includes(
          "test('MyTester automated test",
        ),
      );

    return isWrappedScenario ? 7 : 4;
  }

  private buildSourceSnippet(input: {
    sourceCode: string;
    sourceLine: number;
    sourceColumn: number | null;
    offset: number;
  }): string | null {
    if (!input.sourceCode) {
      return null;
    }

    const generatedLines =
      input.sourceCode.split(/\r?\n/);

    const sourceLines =
      input.offset > 0
        ? generatedLines.slice(
            input.offset,
          )
        : generatedLines;

    const index =
      input.sourceLine - 1;

    if (
      index < 0 ||
      index >= sourceLines.length
    ) {
      return null;
    }

    const from = Math.max(
      0,
      index - 2,
    );
    const to = Math.min(
      sourceLines.length,
      index + 3,
    );

    const width = String(to).length;
    const snippet: string[] = [];

    for (
      let current = from;
      current < to;
      current += 1
    ) {
      const lineNumber =
        current + 1;
      const marker =
        current === index ? '>' : ' ';

      snippet.push(
        `${marker} ${String(
          lineNumber,
        ).padStart(width, ' ')} | ${
          sourceLines[current]
        }`,
      );

      if (
        current === index &&
        input.sourceColumn
      ) {
        snippet.push(
          `  ${' '.repeat(
            width,
          )} | ${' '.repeat(
            Math.max(
              0,
              input.sourceColumn - 1,
            ),
          )}^`,
        );
      }
    }

    return snippet.join('\n');
  }

  private extractFailureComparison(
    errorText: string,
  ): FailureComparison {
    const clean =
      this.stripAnsi(errorText);

    const locatorMatch =
      clean.match(
        /^Locator:\s*(.+)$/m,
      );

    const expectedMatch =
      clean.match(
        /^\s*-\s*Expected substring\s*-\s*\d+\s*\r?\n\s*-\s*(.+)$/m,
      ) ??
      clean.match(
        /^Expected(?: string| pattern)?:\s*(.+)$/m,
      );

    const unexpectedValueMatch =
      clean.match(
        /unexpected value\s+"([\s\S]*?)"\s*(?:\n\s*at\s+|\n?$)/,
      );

    const receivedBlockMatch =
      clean.match(
        /\+ Received string \+ \d+\s*\n([\s\S]*?)(?:\nCall log:|\n\s*at\s+)/,
      );

    let actualResult =
      unexpectedValueMatch?.[1]?.trim() ??
      null;

    if (
      !actualResult &&
      receivedBlockMatch?.[1]
    ) {
      actualResult =
        receivedBlockMatch[1]
          .split(/\r?\n/)
          .map((line) =>
            line.replace(/^\+\s?/, ''),
          )
          .filter((line) =>
            line.trim(),
          )
          .join('\n')
          .trim();
    }

    return {
      locator:
        locatorMatch?.[1]?.trim() ??
        null,
      expectedResult:
        this.limitText(
          expectedMatch?.[1]?.trim() ??
            null,
          5000,
        ),
      actualResult:
        this.limitText(
          actualResult,
          5000,
        ),
    };
  }

  private extractExpectedFromSnippet(
    snippet: string | null,
  ): string | null {
    if (!snippet) {
      return null;
    }

    const patterns = [
      /\.toContainText\(\s*'((?:\\.|[^'])*)'\s*\)/s,
      /\.toContainText\(\s*"((?:\\.|[^"])*)"\s*\)/s,
      /\.toContainText\(\s*`((?:\\.|[^`])*)`\s*\)/s,
      /\.toHaveText\(\s*'((?:\\.|[^'])*)'\s*\)/s,
      /\.toHaveText\(\s*"((?:\\.|[^"])*)"\s*\)/s,
      /\.toHaveText\(\s*`((?:\\.|[^`])*)`\s*\)/s,
      /\.toHaveValue\(\s*'((?:\\.|[^'])*)'\s*\)/s,
      /\.toHaveValue\(\s*"((?:\\.|[^"])*)"\s*\)/s,
      /\.toHaveValue\(\s*`((?:\\.|[^`])*)`\s*\)/s,
    ];

    for (const pattern of patterns) {
      const match = snippet.match(pattern);

      if (match?.[1]) {
        return this.unescapeCodeString(
          match[1],
        );
      }
    }

    return null;
  }

  private unescapeCodeString(
    value: string,
  ): string {
    return value
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\`/g, '`')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  private buildShortMessage(
    error: string | null,
  ): string | null {
    if (!error) {
      return null;
    }

    const firstLine =
      this.stripAnsi(error)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

    return this.limitText(
      firstLine ?? null,
      500,
    );
  }

  private normalizeNativeStatus(
    status: string | undefined,
  ): TestExecutionStatus | null {
    switch (status?.toLowerCase()) {
      case 'passed':
      case 'expected':
        return 'PASSED';

      case 'failed':
      case 'unexpected':
        return 'FAILED';

      case 'timedout':
      case 'timed_out':
      case 'interrupted':
        return 'ERROR';

      case 'skipped':
        return 'SKIPPED';

      default:
        return null;
    }
  }

  private buildActualResult(
    status: TestExecutionStatus,
    title?: string,
  ): string {
    const action =
      title?.trim() || 'L’étape';

    switch (status) {
      case 'PASSED':
        return `${action} a été exécutée avec succès.`;

      case 'FAILED':
        return `${action} a échoué.`;

      case 'ERROR':
        return `${action} a rencontré une erreur technique.`;

      case 'SKIPPED':
        return `${action} n’a pas été exécutée.`;
    }
  }

  private buildSummary(
    steps: TestExecutionStep[],
  ): TestExecutionReport['summary'] {
    return {
      total: steps.length,
      passed: steps.filter(
        (step) =>
          step.status === 'PASSED',
      ).length,
      failed: steps.filter(
        (step) =>
          step.status === 'FAILED',
      ).length,
      errors: steps.filter(
        (step) =>
          step.status === 'ERROR',
      ).length,
      skipped: steps.filter(
        (step) =>
          step.status === 'SKIPPED',
      ).length,
    };
  }

  private findFirstStartedAt(
    tests: JsonReporterTest[],
  ): string | null {
    const dates = tests
      .flatMap((test) =>
        (test.results ?? [])
          .map((result) =>
            this.parseIsoDate(
              result.startTime,
            ),
          )
          .filter(
            (value): value is string =>
              Boolean(value),
          ),
      )
      .sort();

    return dates[0] ?? null;
  }

  private findLastFinishedAt(
    tests: JsonReporterTest[],
  ): string | null {
    const dates = tests
      .flatMap((test) =>
        (test.results ?? [])
          .map((result) => {
            const start =
              this.parseIsoDate(
                result.startTime,
              );

            if (!start) {
              return null;
            }

            return this.addMilliseconds(
              start,
              this.normalizeDuration(
                result.duration,
              ),
            );
          })
          .filter(
            (value): value is string =>
              Boolean(value),
          ),
      )
      .sort();

    return dates.at(-1) ?? null;
  }

  private findFailureDate(
    steps: TestExecutionStep[],
  ): string | null {
    return (
      steps.find(
        (step) =>
          step.status === 'FAILED' ||
          step.status === 'ERROR',
      )?.failedAt ?? null
    );
  }

  private parseIsoDate(
    value: string | undefined,
  ): string | null {
    if (!value) {
      return null;
    }

    const timestamp =
      Date.parse(value);

    if (Number.isNaN(timestamp)) {
      return null;
    }

    return new Date(
      timestamp,
    ).toISOString();
  }

  private addMilliseconds(
    isoDate: string,
    durationMs: number,
  ): string {
    const timestamp =
      Date.parse(isoDate);

    if (Number.isNaN(timestamp)) {
      return new Date().toISOString();
    }

    return new Date(
      timestamp + durationMs,
    ).toISOString();
  }

  private normalizeDuration(
    value: number | undefined,
  ): number {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      return 0;
    }

    return Math.trunc(value);
  }

  private async persistArtifacts(input: {
    tests: JsonReporterTest[];
    processResult: PlaywrightProcessResult;
    status: Exclude<
      TestExecutionStatus,
      'SKIPPED'
    >;
    error: string | null;
  }): Promise<PersistedArtifacts> {
    const targetDirectory = join(
      this.uploadsRoot,
      this.safePathPart(
        input.processResult.runId,
      ),
    );

    await mkdir(targetDirectory, {
      recursive: true,
    });

    const attachments =
      input.tests.flatMap((test) =>
        (test.results ?? []).flatMap(
          (result) =>
            result.attachments ?? [],
        ),
      );

    const screenshot =
      await this.copyAttachment(
        attachments.find((attachment) =>
          this.isScreenshotAttachment(
            attachment,
          ),
        ),
        targetDirectory,
        'failure-screenshot',
      );

    const trace =
      await this.copyAttachment(
        attachments.find((attachment) =>
          this.isTraceAttachment(
            attachment,
          ),
        ),
        targetDirectory,
        'trace',
      );

    await this.copyAttachment(
      attachments.find((attachment) =>
        this.isErrorContextAttachment(
          attachment,
        ),
      ),
      targetDirectory,
      'error-context',
    );

    await this.copyExistingFile(
      input.processResult.reportFilePath,
      targetDirectory,
      'playwright-report.json',
    );

    await this.copyExistingFile(
      input.processResult.specFilePath,
      targetDirectory,
      'generated.spec.ts',
    );

    await this.copyExistingFile(
      input.processResult.stdoutFilePath,
      targetDirectory,
      'stdout.log',
    );

    await this.copyExistingFile(
      input.processResult.stderrFilePath,
      targetDirectory,
      'stderr.log',
    );

    const executionReport =
      await this.createExecutionReport({
        targetDirectory,
        processResult:
          input.processResult,
        status: input.status,
        error: input.error,
      });

    const artifactsZip =
      await this.createArtifactsZip({
        targetDirectory,
      });

    return {
      directoryPath:
        targetDirectory,

      screenshotUrl:
        screenshot?.url ?? null,
      screenshotPath:
        screenshot?.path ?? null,

      traceUrl:
        trace?.url ?? null,
      tracePath:
        trace?.path ?? null,

      executionReportUrl:
        executionReport?.url ?? null,
      executionReportPath:
        executionReport?.path ?? null,

      artifactsZipUrl:
        artifactsZip?.url ?? null,
      artifactsZipPath:
        artifactsZip?.path ?? null,
    };
  }

  private async createExecutionReport(input: {
    targetDirectory: string;
    processResult: PlaywrightProcessResult;
    status: Exclude<
      TestExecutionStatus,
      'SKIPPED'
    >;
    error: string | null;
  }): Promise<CopiedFile | null> {
    try {
      const [
        stdout,
        stderr,
      ] = await Promise.all([
        this.readOptionalFile(
          input.processResult.stdoutFilePath,
        ),
        this.readOptionalFile(
          input.processResult.stderrFilePath,
        ),
      ]);

      const content = [
        'MYTESTER - RAPPORT TECHNIQUE PLAYWRIGHT',
        '=======================================',
        '',
        `Run ID: ${input.processResult.runId}`,
        `Status: ${input.status}`,
        `Started at: ${input.processResult.startedAt}`,
        `Finished at: ${input.processResult.finishedAt}`,
        `Duration: ${input.processResult.durationMs} ms`,
        `Exit code: ${String(
          input.processResult.exitCode,
        )}`,
        `Signal: ${String(
          input.processResult.signal,
        )}`,
        `Timed out: ${String(
          input.processResult.timedOut,
        )}`,
        '',
        'ERREUR PRINCIPALE',
        '------------------',
        this.stripAnsi(
          input.error ??
            'Aucune erreur.',
        ),
        '',
        'STDOUT PLAYWRIGHT',
        '-----------------',
        this.stripAnsi(
          stdout || 'Aucune sortie stdout.',
        ),
        '',
        'STDERR PLAYWRIGHT',
        '-----------------',
        this.stripAnsi(
          stderr || 'Aucune sortie stderr.',
        ),
        '',
      ].join('\n');

      const fileName =
        'execution-report.txt';
      const filePath = join(
        input.targetDirectory,
        fileName,
      );

      await writeFile(
        filePath,
        content,
        'utf8',
      );

      return {
        path: filePath,
        url: this.buildPublicUrl(
          input.targetDirectory,
          fileName,
        ),
      };
    } catch {
      return null;
    }
  }

  private async createArtifactsZip(input: {
    targetDirectory: string;
  }): Promise<CopiedFile | null> {
    const fileName =
      'artifacts.zip';
    const zipPath = join(
      input.targetDirectory,
      fileName,
    );

    try {
      const fileNames =
        await readdir(
          input.targetDirectory,
        );

      const filesToArchive =
        fileNames.filter(
          (name) =>
            name !== fileName,
        );

      await new Promise<void>(
        (resolve, reject) => {
          const output =
            createWriteStream(zipPath);

          const archive = new ZipArchive({
            zlib: {
              level: 9,
            },
          });

          output.once(
            'close',
            () => resolve(),
          );
          output.once(
            'error',
            reject,
          );
          archive.once(
            'error',
            reject,
          );

          archive.pipe(output);

          for (const name of filesToArchive) {
            archive.file(
              join(
                input.targetDirectory,
                name,
              ),
              {
                name,
              },
            );
          }

          void archive.finalize();
        },
      );

      return {
        path: zipPath,
        url: this.buildPublicUrl(
          input.targetDirectory,
          fileName,
        ),
      };
    } catch {
      return null;
    }
  }

  private async copyExistingFile(
    sourcePath: string,
    targetDirectory: string,
    targetFileName: string,
  ): Promise<CopiedFile | null> {
    try {
      const sourceStat =
        await stat(sourcePath);

      if (!sourceStat.isFile()) {
        return null;
      }

      const targetPath = join(
        targetDirectory,
        targetFileName,
      );

      await copyFile(
        sourcePath,
        targetPath,
      );

      return {
        path: targetPath,
        url: this.buildPublicUrl(
          targetDirectory,
          targetFileName,
        ),
      };
    } catch {
      return null;
    }
  }

  private async copyAttachment(
    attachment:
      | JsonReporterAttachment
      | undefined,
    targetDirectory: string,
    targetBaseName: string,
  ): Promise<CopiedFile | null> {
    const sourcePath =
      attachment?.path;

    if (!sourcePath) {
      return null;
    }

    try {
      const sourceStat =
        await stat(sourcePath);

      if (!sourceStat.isFile()) {
        return null;
      }

      const extension =
        extname(sourcePath) ||
        extname(
          attachment.name ?? '',
        ) ||
        '.bin';

      const fileName = `${this.safePathPart(
        targetBaseName,
      )}${extension}`;

      const targetPath = join(
        targetDirectory,
        fileName,
      );

      await copyFile(
        sourcePath,
        targetPath,
      );

      return {
        path: targetPath,
        url: this.buildPublicUrl(
          targetDirectory,
          fileName,
        ),
      };
    } catch {
      return null;
    }
  }

  private isScreenshotAttachment(
    attachment: JsonReporterAttachment,
  ): boolean {
    const contentType =
      attachment.contentType
        ?.toLowerCase() ?? '';
    const name =
      attachment.name
        ?.toLowerCase() ?? '';
    const filePath =
      attachment.path
        ?.toLowerCase() ?? '';

    return (
      contentType.startsWith(
        'image/',
      ) ||
      name.includes(
        'screenshot',
      ) ||
      /\.(png|jpe?g|webp)$/.test(
        filePath,
      )
    );
  }

  private isTraceAttachment(
    attachment: JsonReporterAttachment,
  ): boolean {
    const name =
      attachment.name
        ?.toLowerCase() ?? '';
    const filePath =
      attachment.path
        ?.toLowerCase() ?? '';

    return (
      name.includes('trace') ||
      filePath.endsWith(
        'trace.zip',
      )
    );
  }

  private isErrorContextAttachment(
    attachment: JsonReporterAttachment,
  ): boolean {
    const name =
      attachment.name
        ?.toLowerCase() ?? '';
    const filePath =
      attachment.path
        ?.toLowerCase() ?? '';

    return (
      name.includes(
        'error-context',
      ) ||
      filePath.endsWith(
        'error-context.md',
      )
    );
  }

  private buildPublicUrl(
    directoryPath: string,
    fileName: string,
  ): string {
    return `/uploads/automation-runs/${basename(
      directoryPath,
    )}/${fileName}`;
  }

  private async readOptionalFile(
    filePath: string,
  ): Promise<string> {
    try {
      return await readFile(
        filePath,
        'utf8',
      );
    } catch {
      return '';
    }
  }

  private stripAnsi(
    value: string,
  ): string {
    return value.replace(
      // eslint-disable-next-line no-control-regex
      /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      '',
    );
  }

  private limitText(
    value: string | null,
    maxLength: number,
  ): string | null {
    if (!value) {
      return null;
    }

    return value.length > maxLength
      ? `${value.slice(
          0,
          maxLength,
        )}…`
      : value;
  }

  private safePathPart(
    value: string,
  ): string {
    return value
      .replace(
        /[^a-zA-Z0-9_-]/g,
        '_',
      )
      .slice(0, 120);
  }

  private isRecord(
    value: unknown,
  ): value is Record<
    string,
    unknown
  > {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }
}
