import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const nodeRequire = createRequire(__filename);

export type CodegenSessionStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

type CodegenSession = {
  id: string;
  url: string;
  testCaseId: string | null;
  status: CodegenSessionStatus;
  processId: number | null;
  outputFilePath: string;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
  process: ChildProcess | null;
};

@Injectable()
export class PlaywrightCodegenService {
  private readonly sessions = new Map<string, CodegenSession>();

  constructor(private readonly prisma: PrismaService) {}

  async start(url: string, testCaseId?: string) {
    const validatedUrl = this.validateUrl(url);

    if (testCaseId) {
      const testCase = await this.prisma.testCase.findUnique({
        where: { id: testCaseId },
        select: { id: true },
      });

      if (!testCase) {
        throw new NotFoundException('Cas de test introuvable');
      }
    }

    const sessionId = `rec_${randomUUID()}`;
    const outputDirectory = join(
      process.cwd(),
      'uploads',
      'codegen',
      sessionId,
    );
    const outputFilePath = join(
      outputDirectory,
      'recorded.spec.ts',
    );

    await mkdir(outputDirectory, { recursive: true });

    const session: CodegenSession = {
      id: sessionId,
      url: validatedUrl.toString(),
      testCaseId: testCaseId ?? null,
      status: 'RUNNING',
      processId: null,
      outputFilePath,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      process: null,
    };

    this.sessions.set(sessionId, session);

    try {
      const playwrightPackageJsonPath = nodeRequire.resolve(
        'playwright/package.json',
      );

      const playwrightCliPath = join(
        dirname(playwrightPackageJsonPath),
        'cli.js',
      );

      if (!existsSync(playwrightCliPath)) {
        throw new Error(
          `Playwright CLI introuvable : ${playwrightCliPath}`,
        );
      }

      const child = spawn(
        process.execPath,
        [
          playwrightCliPath,
          'codegen',
          '--target=playwright-test',
          '--output',
          outputFilePath,
          validatedUrl.toString(),
        ],
        {
          cwd: process.cwd(),
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
          env: {
            ...process.env,
          },
        },
      );

      session.process = child;
      session.processId = child.pid ?? null;

      child.once('error', (error) => {
        this.markFailed(
          sessionId,
          error instanceof Error
            ? error.message
            : String(error),
        );
      });

      child.once('exit', (exitCode, signal) => {
        void this.finalizeSession(
          sessionId,
          exitCode,
          signal,
        );
      });

      await new Promise<void>((resolve, reject) => {
        const onSpawn = () => {
          child.off('error', onInitialError);
          resolve();
        };

        const onInitialError = (error: Error) => {
          child.off('spawn', onSpawn);
          reject(error);
        };

        child.once('spawn', onSpawn);
        child.once('error', onInitialError);
      });

      child.unref();

      return {
        sessionId,
        status: session.status,
        processId: session.processId,
        url: session.url,
        testCaseId: session.testCaseId,
        message: 'Enregistrement Playwright démarré',
      };
    } catch (error) {
      await rm(outputDirectory, {
        recursive: true,
        force: true,
      }).catch(() => undefined);

      this.sessions.delete(sessionId);

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        '[PlaywrightCodegenService] Démarrage impossible:',
        message,
      );

      throw new InternalServerErrorException(
        'Impossible de démarrer Playwright Codegen',
      );
    }
  }

  async getStatus(sessionId: string) {
    const session = this.getSession(sessionId);

    let code: string | null = null;

    if (session.status === 'COMPLETED') {
      code = await this.readGeneratedCode(session);
    }

    return {
      sessionId: session.id,
      status: session.status,
      processId: session.processId,
      url: session.url,
      testCaseId: session.testCaseId,
      createdAt: session.createdAt,
      finishedAt: session.finishedAt,
      error: session.error,
      code,
    };
  }

  async importIntoTestCase(
    sessionId: string,
    requestedTestCaseId?: string,
  ) {
    const session = this.getSession(sessionId);

    if (session.status !== 'COMPLETED') {
      throw new BadRequestException(
        `La session n'est pas terminée. Statut actuel : ${session.status}`,
      );
    }

    const testCaseId =
      requestedTestCaseId?.trim() ||
      session.testCaseId;

    if (!testCaseId) {
      throw new BadRequestException(
        'testCaseId est obligatoire pour importer le code',
      );
    }

    const code = await this.readGeneratedCode(session);

    const existing = await this.prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(
        'Cas de test introuvable',
      );
    }

    const testCase = await this.prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        automationFramework: 'PLAYWRIGHT',
        automationCode: code,
      },
      include: {
        suite: true,
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
      },
    });

    return {
      imported: true,
      sessionId,
      testCase,
    };
  }

  cancel(sessionId: string) {
    const session = this.getSession(sessionId);

    if (session.status !== 'RUNNING') {
      return {
        sessionId,
        status: session.status,
        message: 'La session est déjà terminée',
      };
    }

    const processId = session.processId;

    if (processId) {
      if (process.platform === 'win32') {
        const killer = spawn(
          'taskkill',
          ['/PID', String(processId), '/T', '/F'],
          {
            windowsHide: true,
            stdio: 'ignore',
          },
        );

        killer.unref();
      } else {
        try {
          process.kill(-processId, 'SIGTERM');
        } catch {
          session.process?.kill('SIGTERM');
        }
      }
    }

    session.status = 'CANCELLED';
    session.finishedAt = new Date().toISOString();
    session.process = null;

    return {
      sessionId,
      status: session.status,
      message: 'Enregistrement annulé',
    };
  }

  private async finalizeSession(
    sessionId: string,
    exitCode: number | null,
    signal: NodeJS.Signals | null,
  ) {
    const session = this.sessions.get(sessionId);

    if (
      !session ||
      session.status === 'CANCELLED'
    ) {
      return;
    }

    session.process = null;
    session.finishedAt = new Date().toISOString();

    // Petit délai pour laisser Playwright terminer l'écriture du fichier.
    await new Promise((resolve) =>
      setTimeout(resolve, 300),
    );

    try {
      const code =
        await this.readGeneratedCode(session);

      if (!code.trim()) {
        throw new Error(
          'Aucun code Playwright n’a été généré',
        );
      }

      session.status = 'COMPLETED';
      session.error = null;
    } catch (error) {
      session.status = 'FAILED';
      session.error =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        exitCode !== 0 &&
        exitCode !== null
      ) {
        session.error += ` (exitCode=${exitCode})`;
      }

      if (signal) {
        session.error += ` (signal=${signal})`;
      }
    }
  }

  private markFailed(
    sessionId: string,
    message: string,
  ) {
    const session = this.sessions.get(sessionId);

    if (
      !session ||
      session.status !== 'RUNNING'
    ) {
      return;
    }

    session.status = 'FAILED';
    session.error = message;
    session.finishedAt =
      new Date().toISOString();
    session.process = null;
  }

  private getSession(sessionId: string) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new NotFoundException(
        'Session d’enregistrement introuvable',
      );
    }

    return session;
  }

  private async readGeneratedCode(
    session: CodegenSession,
  ) {
    try {
      return await readFile(
        session.outputFilePath,
        'utf8',
      );
    } catch {
      throw new NotFoundException(
        'Le fichier Playwright généré est introuvable',
      );
    }
  }

  private validateUrl(url: string) {
    if (!url?.trim()) {
      throw new BadRequestException(
        'URL obligatoire',
      );
    }

    let validatedUrl: URL;

    try {
      validatedUrl = new URL(url.trim());
    } catch {
      throw new BadRequestException(
        'URL invalide',
      );
    }

    if (
      !['http:', 'https:'].includes(
        validatedUrl.protocol,
      )
    ) {
      throw new BadRequestException(
        'Seules les URL HTTP et HTTPS sont autorisées',
      );
    }

    return validatedUrl;
  }
}
