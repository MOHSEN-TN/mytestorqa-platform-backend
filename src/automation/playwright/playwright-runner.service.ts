import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { RunPlaywrightDto } from '../dto/run-playwright.dto';
import { PlaywrightRunResult } from './playwright.types';

@Injectable()
export class PlaywrightRunnerService {
  async runSmokeTest(dto: RunPlaywrightDto): Promise<PlaywrightRunResult> {
  const start = Date.now();
  const errors: string[] = [];

  if (!dto?.targetUrl) {
    return {
      status: 'FAILED',
      durationMs: Date.now() - start,
      errors: ['targetUrl is required'],
    };
  }

  const browser = await chromium.launch({
    headless: dto.headless ?? true,
  });

  try {
    const page = await browser.newPage();

      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });

      await page.goto(dto.targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: dto.timeoutMs ?? 30000,
      });

      await page.waitForLoadState('networkidle', {
        timeout: 5000,
      }).catch(() => undefined);

      return {
        status: 'PASSED',
        title: await page.title(),
        finalUrl: page.url(),
        durationMs: Date.now() - start,
        errors,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));

      return {
        status: 'FAILED',
        durationMs: Date.now() - start,
        errors,
      };
    } finally {
      await browser.close();
    }
  }
}