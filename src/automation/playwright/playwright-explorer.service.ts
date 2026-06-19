import { Injectable } from '@nestjs/common';
import { chromium, Page } from 'playwright';
import {
  ExploredPage,
  ExplorationResult,
  ExplorerInput,
} from './playwright.types';

@Injectable()
export class PlaywrightExplorerService {
  async explore(input: ExplorerInput): Promise<ExplorationResult> {
    const depth = input.depth ?? 1;
    const startUrl = input.targetUrl;

    const result: ExplorationResult = {
      startUrl,
      depth,
      pages: [],
      errors: [],
    };

    const visited = new Set<string>();
    const queue: Array<{ url: string; level: number }> = [
      { url: startUrl, level: 1 },
    ];

    const browser = await chromium.launch({
      headless: true,
    });

    try {
      const context = await browser.newContext({
        viewport: {
          width: 1366,
          height: 768,
        },
      });

      const page = await context.newPage();

      while (queue.length > 0) {
        const current = queue.shift();

        if (!current) {
          continue;
        }

        if (visited.has(current.url)) {
          continue;
        }

        if (current.level > depth) {
          continue;
        }

        visited.add(current.url);

        try {
          const exploredPage = await this.exploreSinglePage(
            page,
            current.url,
          );

          result.pages.push(exploredPage);

          if (current.level < depth) {
            const nextLinks = exploredPage.links
              .map((link) => link.href)
              .filter((href) => this.isValidUrl(href))
              .filter((href) => this.isSameOrigin(startUrl, href))
              .slice(0, 10);

            for (const href of nextLinks) {
              if (!visited.has(href)) {
                queue.push({
                  url: href,
                  level: current.level + 1,
                });
              }
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to explore ${current.url}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      await browser.close();
    }

    return result;
  }

  private async exploreSinglePage(
    page: Page,
    url: string,
  ): Promise<ExploredPage> {
    const consoleErrors: string[] = [];

    page.removeAllListeners('console');

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForLoadState('networkidle', {
      timeout: 5000,
    }).catch(() => undefined);

    const data = await page.evaluate(() => {
      const getText = (element: Element | null) =>
        element?.textContent?.replace(/\s+/g, ' ').trim() || '';

      const headings = Array.from(
        document.querySelectorAll('h1, h2, h3'),
      )
        .map((element) => getText(element))
        .filter(Boolean)
        .slice(0, 30);

      const links = Array.from(document.querySelectorAll('a'))
        .map((element) => ({
          text: getText(element),
          href: (element as HTMLAnchorElement).href,
        }))
        .filter((link) => link.href)
        .slice(0, 80);

      const buttons = Array.from(
        document.querySelectorAll('button, input[type="submit"], input[type="button"]'),
      )
        .map((element) => ({
          text:
            getText(element) ||
            (element as HTMLInputElement).value ||
            element.getAttribute('aria-label') ||
            '',
        }))
        .filter((button) => button.text)
        .slice(0, 50);

      const inputs = Array.from(
        document.querySelectorAll('input, textarea, select'),
      )
        .map((element) => {
          const input = element as HTMLInputElement;
          const id = input.id;
          const label = id
            ? document.querySelector(`label[for="${id}"]`)?.textContent || ''
            : '';

          return {
            name: input.name || input.id || '',
            type: input.type || element.tagName.toLowerCase(),
            placeholder: input.placeholder || '',
            label: label.replace(/\s+/g, ' ').trim(),
          };
        })
        .slice(0, 80);

      const forms = Array.from(document.querySelectorAll('form'))
        .map((form) => {
          const formElement = form as HTMLFormElement;

          const formInputs = Array.from(
            formElement.querySelectorAll('input, textarea, select'),
          ).map((element) => {
            const input = element as HTMLInputElement;

            return {
              name: input.name || input.id || '',
              type: input.type || element.tagName.toLowerCase(),
              placeholder: input.placeholder || '',
              label: '',
            };
          });

          return {
            action: formElement.action || '',
            method: formElement.method || 'GET',
            inputs: formInputs,
          };
        })
        .slice(0, 20);

      return {
        headings,
        links,
        buttons,
        inputs,
        forms,
      };
    });

    return {
      url: page.url(),
      title: await page.title(),
      headings: data.headings,
      links: data.links,
      buttons: data.buttons,
      inputs: data.inputs,
      forms: data.forms,
      consoleErrors,
    };
  }

  private isValidUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private isSameOrigin(startUrl: string, targetUrl: string) {
    try {
      const start = new URL(startUrl);
      const target = new URL(targetUrl);

      return start.origin === target.origin;
    } catch {
      return false;
    }
  }
}