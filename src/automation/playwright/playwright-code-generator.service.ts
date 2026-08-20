import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlaywrightGeneratedCode } from './playwright.types';

@Injectable()
export class PlaywrightCodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateFromTestCase(
    testCaseId: string,
    baseUrl?: string,
  ): Promise<PlaywrightGeneratedCode> {
    const testCase = await this.prisma.testCase.findUnique({
      where: {
        id: testCaseId,
      },
      include: {
        steps: {
          orderBy: {
            stepOrder: 'asc',
          },
        },
      },
    });

    if (!testCase) {
      throw new NotFoundException('Test case not found');
    }

    const code = this.buildPlaywrightCode({
      title: testCase.title,
      description: testCase.description || '',
      expected: testCase.expected || '',
      baseUrl,
      steps: testCase.steps.map((step) => ({
        order: step.stepOrder,
        action: step.action,
        expected: step.expected || '',
      })),
    });

    return {
      testCaseId,
      title: testCase.title,
      framework: 'playwright',
      language: 'typescript',
      code,
    };
  }

  private buildPlaywrightCode(input: {
    title: string;
    description: string;
    expected: string;
    baseUrl?: string;
    steps: Array<{
      order: number;
      action: string;
      expected: string;
    }>;
  }) {
    const lines: string[] = [];

    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push('');
    lines.push(`test('${this.escape(input.title)}', async ({ page }) => {`);

    if (input.description) {
      lines.push(`  // ${this.escapeComment(input.description)}`);
    }

    if (input.baseUrl) {
      lines.push(`  await page.goto('${this.escape(input.baseUrl)}');`);
    } else {
      lines.push(`  // TODO: define the application URL`);
      lines.push(`  // await page.goto('https://example.com');`);
    }

    for (const step of input.steps) {
      lines.push('');
      lines.push(`  // Step ${step.order}: ${this.escapeComment(step.action)}`);

      const generated = this.generateStepCode(step.action, step.expected);

      for (const line of generated) {
        lines.push(`  ${line}`);
      }
    }

    if (input.expected) {
      lines.push('');
      lines.push(`  // Global expected result`);
      lines.push(
        `  await expect(page.locator('body')).toContainText('${this.escape(
          input.expected,
        )}');`,
      );
    }

    lines.push(`});`);

    return lines.join('\n');
  }

  private generateStepCode(action: string, expected?: string) {
    const normalized = action.toLowerCase();
    const lines: string[] = [];

    if (
      normalized.includes('aller') ||
      normalized.includes('ouvrir') ||
      normalized.includes('go to') ||
      normalized.includes('navigate')
    ) {
      const url = this.extractUrl(action);

      if (url) {
        lines.push(`await page.goto('${this.escape(url)}');`);
      } else {
        lines.push(`// TODO: add page.goto(...) for this navigation step`);
      }
    } else if (
      normalized.includes('cliquer') ||
      normalized.includes('click') ||
      normalized.includes('appuyer')
    ) {
      const target = this.extractQuotedText(action) || this.extractAfterKeyword(action);

      if (target) {
        lines.push(
          `await page.getByRole('button', { name: /${this.escapeRegex(
            target,
          )}/i }).click();`,
        );
      } else {
        lines.push(`// TODO: add locator click for this step`);
      }
    } else if (
      normalized.includes('saisir') ||
      normalized.includes('remplir') ||
      normalized.includes('enter') ||
      normalized.includes('type') ||
      normalized.includes('fill')
    ) {
      const value = this.extractQuotedText(action) || 'TODO_VALUE';

      lines.push(
        `await page.locator('input').first().fill('${this.escape(value)}');`,
      );
    } else if (
      normalized.includes('vérifier') ||
      normalized.includes('verifier') ||
      normalized.includes('check') ||
      normalized.includes('assert') ||
      normalized.includes('voir')
    ) {
      const expectedText = expected || this.extractQuotedText(action);

      if (expectedText) {
        lines.push(
          `await expect(page.locator('body')).toContainText('${this.escape(
            expectedText,
          )}');`,
        );
      } else {
        lines.push(`// TODO: add assertion for this verification step`);
      }
    } else {
      lines.push(`// TODO: implement this manual step with a stable locator`);
    }

    if (expected) {
      lines.push(
        `// Expected: ${this.escapeComment(expected)}`,
      );
    }

    return lines;
  }

  private extractUrl(text: string) {
    const match = text.match(/https?:\/\/[^\s]+/i);
    return match?.[0];
  }

  private extractQuotedText(text: string) {
    const match = text.match(/["'“”](.*?)["'“”]/);
    return match?.[1];
  }

  private extractAfterKeyword(text: string) {
    const parts = text.split(/sur|on|button|bouton/i);
    return parts[1]?.trim();
  }

  private escape(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private escapeComment(value: string) {
    return value.replace(/\n/g, ' ').replace(/\*\//g, '');
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}