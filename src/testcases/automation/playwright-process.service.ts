import {
  Injectable,
  InternalServerErrorException,
  RequestTimeoutException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  delimiter,
  dirname,
  join,
} from 'node:path';
import type { ChildProcess } from 'node:child_process';
import type { BuiltPlaywrightSpec } from './playwright-spec-builder.service';

const projectRequire = createRequire(
  join(process.cwd(), 'package.json'),
);

export type PlaywrightProcessOptions = {
  runId: string;
  spec: BuiltPlaywrightSpec;
  headed?: boolean;
  slowMo?: number;
  timeoutMs?: number;
};

export type PlaywrightProcessResult = {
  runId: string;

  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;

  startedAt: string;
  finishedAt: string;
  durationMs: number;

  runDirectory: string;
  specFilePath: string;
  configFilePath: string;
  reportFilePath: string;
  stdoutFilePath: string;
  stderrFilePath: string;
  artifactsDirectory: string;
};

@Injectable()
export class PlaywrightProcessService {
  /**
   * Le dossier est placé sous node_modules/.cache pour deux raisons :
   * 1. NestJS ne surveille pas node_modules, donc aucun redémarrage du watcher.
   * 2. Les fichiers temporaires peuvent résoudre @playwright/test depuis
   *    le node_modules du backend.
   *
   * En production, ce chemin peut être remplacé par la variable :
   * MYTESTER_PLAYWRIGHT_RUNS_DIR
   */
  private readonly storageRoot =
    process.env.MYTESTER_PLAYWRIGHT_RUNS_DIR?.trim() ||
    join(
      process.cwd(),
      'node_modules',
      '.cache',
      'mytester-playwright-runs',
    );

  private readonly defaultTimeoutMs = 120_000;
  private readonly maxTimeoutMs = 10 * 60_000;

  async execute(
    options: PlaywrightProcessOptions,
  ): Promise<PlaywrightProcessResult> {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const runDirectory = join(
      this.storageRoot,
      this.safePathPart(options.runId),
    );

    const artifactsDirectory = join(
      runDirectory,
      'test-results',
    );

    const specFilePath = join(
      runDirectory,
      options.spec.fileName,
    );

    const configFilePath = join(
      runDirectory,
      'playwright.config.cjs',
    );

    const reportFilePath = join(
      runDirectory,
      'playwright-report.json',
    );

    const stdoutFilePath = join(
      runDirectory,
      'stdout.log',
    );

    const stderrFilePath = join(
      runDirectory,
      'stderr.log',
    );

    await mkdir(artifactsDirectory, {
      recursive: true,
    });

    await writeFile(
      specFilePath,
      options.spec.sourceCode,
      'utf8',
    );

    const playwrightTestEntry =
      this.resolvePlaywrightTestEntry();

    await writeFile(
      configFilePath,
      this.buildConfig({
        runDirectory,
        specFileName: options.spec.fileName,
        artifactsDirectory,
        reportFilePath,
        headed: options.headed ?? false,
        slowMo: this.normalizeSlowMo(
          options.slowMo,
          options.headed ?? false,
        ),
        playwrightTestEntry,
      }),
      'utf8',
    );

    const playwrightCliPath =
      this.resolvePlaywrightTestCli();

    const timeoutMs = this.normalizeTimeout(
      options.timeoutMs,
    );

    const stdoutStream = createWriteStream(
      stdoutFilePath,
      { flags: 'w' },
    );

    const stderrStream = createWriteStream(
      stderrFilePath,
      { flags: 'w' },
    );

    let child: ChildProcess | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let timedOut = false;

    try {
      child = spawn(
        process.execPath,
        [
          playwrightCliPath,
          'test',
          '--config',
          configFilePath,
        ],
        {
          cwd: runDirectory,
          shell: false,
          windowsHide: false,
          env: {
            ...process.env,
            CI: '0',
            FORCE_COLOR: '0',
            NODE_PATH: this.buildNodePath(),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      child.stdout?.pipe(stdoutStream);
      child.stderr?.pipe(stderrStream);

      const processResult =
        await new Promise<{
          exitCode: number | null;
          signal: NodeJS.Signals | null;
        }>((resolve, reject) => {
          if (!child) {
            reject(
              new Error(
                'Le processus Playwright n’a pas été créé',
              ),
            );
            return;
          }

          child.once('error', reject);

          child.once(
            'exit',
            (
              exitCode: number | null,
              signal: NodeJS.Signals | null,
            ) => {
              resolve({
                exitCode,
                signal,
              });
            },
          );

          timeoutHandle = setTimeout(() => {
            timedOut = true;
            void this.killProcessTree(child);
          }, timeoutMs);
        });

      const finishedAt = new Date().toISOString();

      return {
        runId: options.runId,

        exitCode: processResult.exitCode,
        signal: processResult.signal,
        timedOut,

        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,

        runDirectory,
        specFilePath,
        configFilePath,
        reportFilePath,
        stdoutFilePath,
        stderrFilePath,
        artifactsDirectory,
      };
    } catch (error) {
      if (timedOut) {
        throw new RequestTimeoutException(
          `L’exécution Playwright a dépassé ${timeoutMs} ms`,
        );
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Impossible de lancer Playwright Test : ${message}`,
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      stdoutStream.end();
      stderrStream.end();
    }
  }

  async cleanup(runDirectory: string): Promise<void> {
    await rm(runDirectory, {
      recursive: true,
      force: true,
    });
  }

  private resolvePlaywrightTestCli(): string {
    try {
      const packageJsonPath =
        projectRequire.resolve(
          '@playwright/test/package.json',
        );

      return join(
        dirname(packageJsonPath),
        'cli.js',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `CLI @playwright/test introuvable. Installez-le avec "npm install -D @playwright/test". Détail : ${message}`,
      );
    }
  }

  private resolvePlaywrightTestEntry(): string {
    try {
      return projectRequire.resolve(
        '@playwright/test',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      throw new InternalServerErrorException(
        `Module @playwright/test introuvable. Installez-le avec "npm install -D @playwright/test". Détail : ${message}`,
      );
    }
  }

  private buildConfig(input: {
    runDirectory: string;
    specFileName: string;
    artifactsDirectory: string;
    reportFilePath: string;
    headed: boolean;
    slowMo: number;
    playwrightTestEntry: string;
  }): string {
    const launchOptions =
      input.slowMo > 0
        ? `{ slowMo: ${input.slowMo} }`
        : '{}';

    return [
      `const { defineConfig } = require(${JSON.stringify(
        input.playwrightTestEntry,
      )});`,
      ``,
      `module.exports = defineConfig({`,
      `  testDir: ${JSON.stringify(input.runDirectory)},`,
      `  testMatch: ${JSON.stringify(input.specFileName)},`,
      `  fullyParallel: false,`,
      `  workers: 1,`,
      `  retries: 0,`,
      `  timeout: 60000,`,
      `  expect: {`,
      `    timeout: 10000,`,
      `  },`,
      `  reporter: [`,
      `    ['json', { outputFile: ${JSON.stringify(
        input.reportFilePath,
      )} }],`,
      `  ],`,
      `  outputDir: ${JSON.stringify(
        input.artifactsDirectory,
      )},`,
      `  use: {`,
      `    browserName: 'chromium',`,
      `    headless: ${String(!input.headed)},`,
      `    actionTimeout: 15000,`,
      `    navigationTimeout: 30000,`,
      `    screenshot: 'only-on-failure',`,
      `    trace: 'retain-on-failure',`,
      `    video: 'off',`,
      `    launchOptions: ${launchOptions},`,
      `  },`,
      `});`,
      ``,
    ].join('\n');
  }

  private buildNodePath(): string {
    const projectNodeModules = join(
      process.cwd(),
      'node_modules',
    );

    const existingNodePath =
      process.env.NODE_PATH?.trim();

    return existingNodePath
      ? `${projectNodeModules}${delimiter}${existingNodePath}`
      : projectNodeModules;
  }

  private normalizeSlowMo(
    slowMo: number | undefined,
    headed: boolean,
  ): number {
    if (!headed) {
      return 0;
    }

    const value = slowMo ?? 500;

    return Math.min(
      Math.max(Math.trunc(value), 0),
      3000,
    );
  }

  private normalizeTimeout(
    timeoutMs: number | undefined,
  ): number {
    const value =
      timeoutMs ?? this.defaultTimeoutMs;

    return Math.min(
      Math.max(
        Math.trunc(value),
        10_000,
      ),
      this.maxTimeoutMs,
    );
  }

  private async killProcessTree(
    child: ChildProcess | null,
  ): Promise<void> {
    const processId = child?.pid;

    if (!processId) {
      return;
    }

    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        const killer = spawn(
          'taskkill',
          [
            '/PID',
            String(processId),
            '/T',
            '/F',
          ],
          {
            windowsHide: true,
            stdio: 'ignore',
            shell: false,
          },
        );

        killer.once('exit', () => resolve());
        killer.once('error', () => resolve());
      });

      return;
    }

    try {
      process.kill(processId, 'SIGTERM');
    } catch {
      child?.kill('SIGTERM');
    }
  }

  private safePathPart(value: string): string {
    return value
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
  }
}
