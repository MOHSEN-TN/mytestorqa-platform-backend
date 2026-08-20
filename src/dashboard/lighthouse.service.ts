import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { resolve } from 'node:path';

type LighthouseCategory = {
  score: number | null;
};

type LighthouseCliResult = {
  finalDisplayedUrl?: string;
  finalUrl?: string;
  fetchTime?: string;
  lighthouseVersion?: string;
  categories: Record<string, LighthouseCategory | undefined>;
};

@Injectable()
export class LighthouseService {
  private readonly timeoutMs = 300_000;
  private readonly maxWaitForLoadMs = 90_000;

  async audit(rawUrl: string) {
    const url = this.normalizeUrl(rawUrl);
    const startedAt = Date.now();

    try {
      const lhr = await this.runLighthouseInChildProcess(url);

      const performance = this.toPercent(
        lhr.categories.performance?.score,
      );
      const accessibility = this.toPercent(
        lhr.categories.accessibility?.score,
      );
      const bestPractices = this.toPercent(
        lhr.categories['best-practices']?.score,
      );
      const seo = this.toPercent(lhr.categories.seo?.score);

      const categoryScores = [
        performance,
        accessibility,
        bestPractices,
        seo,
      ];

      const qualityScore = categoryScores.every(
        (score): score is number => score !== null,
      )
        ? Math.round(
            categoryScores.reduce((sum, score) => sum + score, 0) /
              categoryScores.length,
          )
        : null;

      return {
        requestedUrl: url,
        finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? url,
        qualityScore,
        scores: {
          performance,
          accessibility,
          bestPractices,
          seo,
        },
        lighthouseVersion: lhr.lighthouseVersion ?? null,
        auditedAt: lhr.fetchTime ?? new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';

      if (
        message.includes('PROTOCOL_TIMEOUT') ||
        message.includes('Target.getTargetInfo') ||
        message.includes('DevTools protocol')
      ) {
        throw new InternalServerErrorException(
          'Audit Lighthouse interrompu : Chrome DevTools n’a pas répondu à temps. Le dernier audit valide reste disponible.',
        );
      }

      throw new InternalServerErrorException(
        `Audit Lighthouse impossible : ${message}`,
      );
    }
  }

  private runLighthouseInChildProcess(
    url: string,
  ): Promise<LighthouseCliResult> {
    return new Promise<LighthouseCliResult>((resolvePromise, rejectPromise) => {
      /*
       * Important sous Windows :
       * on n'exécute pas npx.cmd avec spawn(shell:false), ce qui peut produire EINVAL.
       * On lance directement le CLI Lighthouse avec le binaire Node courant.
       */
      const lighthouseCliPath = resolve(
        process.cwd(),
        'node_modules',
        'lighthouse',
        'cli',
        'index.js',
      );

      const args = [
        lighthouseCliPath,
        url,
        '--quiet',
        '--output=json',
        '--output-path=stdout',
        '--only-categories=performance,accessibility,best-practices,seo',
        `--max-wait-for-load=${this.maxWaitForLoadMs}`,
        '--chrome-flags=--headless --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check',
      ];

      let child: ChildProcessWithoutNullStreams;

      try {
        child = spawn(process.execPath, args, {
          shell: false,
          windowsHide: true,
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }) as ChildProcessWithoutNullStreams;
      } catch (error: unknown) {
        rejectPromise(
          new Error(
            `Impossible de démarrer Lighthouse : ${
              error instanceof Error ? error.message : 'Erreur inconnue'
            }`,
          ),
        );
        return;
      }

      let stdout = '';
      let stderr = '';
      let settled = false;

      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        rejectPromise(error);
      };

      const finishResolve = (result: LighthouseCliResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(result);
      };

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (error) => {
        finishReject(
          new Error(`Lighthouse n’a pas pu démarrer : ${error.message}`),
        );
      });

      child.on('close', (code) => {
        if (settled) return;

        if (code !== 0) {
          const details =
            stderr.trim() ||
            stdout.trim() ||
            `Processus Lighthouse terminé avec le code ${code ?? 'inconnu'}.`;

          finishReject(new Error(details));
          return;
        }

        const raw = stdout.trim();

        if (!raw) {
          finishReject(
            new Error('Lighthouse n’a retourné aucun résultat JSON.'),
          );
          return;
        }

        try {
          const parsed = JSON.parse(raw) as LighthouseCliResult;

          if (!parsed?.categories) {
            finishReject(
              new Error('Le résultat Lighthouse JSON est incomplet.'),
            );
            return;
          }

          finishResolve(parsed);
        } catch (error: unknown) {
          finishReject(
            new Error(
              `Impossible de lire le résultat Lighthouse : ${
                error instanceof Error ? error.message : 'JSON invalide'
              }`,
            ),
          );
        }
      });

      const timer = setTimeout(() => {
        this.killChildProcess(child);

        finishReject(
          new Error(
            `Délai Lighthouse dépassé (${this.timeoutMs / 1000}s).`,
          ),
        );
      }, this.timeoutMs);
    });
  }

  private killChildProcess(child: ChildProcessWithoutNullStreams): void {
    if (!child.pid) {
      return;
    }

    if (process.platform === 'win32') {
      const killer = spawn(
        'taskkill',
        ['/pid', String(child.pid), '/t', '/f'],
        {
          shell: false,
          windowsHide: true,
        },
      );

      killer.on('error', () => {
        try {
          child.kill();
        } catch {
          // Processus déjà arrêté.
        }
      });

      return;
    }

    try {
      child.kill('SIGKILL');
    } catch {
      // Processus déjà arrêté.
    }
  }

  private normalizeUrl(rawUrl: string): string {
    const value = rawUrl?.trim();

    if (!value) {
      throw new BadRequestException(
        'Le projet ne possède pas de baseUrl.',
      );
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(value);
    } catch {
      throw new BadRequestException(
        'La baseUrl du projet est invalide.',
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        'La baseUrl doit utiliser http ou https.',
      );
    }

    return parsedUrl.toString();
  }

  private toPercent(score: number | null | undefined): number | null {
    if (typeof score !== 'number') {
      return null;
    }

    return Math.round(score * 100);
  }
}
