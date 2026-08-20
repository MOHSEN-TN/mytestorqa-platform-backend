import { Injectable } from '@nestjs/common';
import { chromium, type Page } from 'playwright';

export type LocatorCandidate = {
  locator: string;
  type: 'role' | 'text' | 'testid' | 'id' | 'name' | 'css' | 'xpath';
  score: number;
  reason: string;
};

export type SmartLocatorResult = {
  found: boolean;
  recommendedLocator: string | null;
  recommendedActionCode: string | null;
  recommendedAssertionCode: string | null;
  globalAssertionsCode: string[];
  destinationAssertionsCode: string[];
  alternatives: LocatorCandidate[];
  matchedText: string | null;
  elementType: string | null;
};

export type PageStructureResult = {
  hasBody: boolean;
  hasHeader: boolean;
  hasNav: boolean;
  hasFooter: boolean;
  hasMain: boolean;
  hasLogo: boolean;
  logoLocator: string | null;
  globalAssertionsCode: string[];
};

type PageElement = {
  tagName: string;
  text: string;
  role: string | null;
  id: string | null;
  name: string | null;
  testId: string | null;
  href: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  isInsideNav: boolean;
};

@Injectable()
export class SmartLocatorService {
  async analyzePageStructure(url: string): Promise<PageStructureResult> {
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: {
          width: 1366,
          height: 768,
        },
      });

      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const structure = await this.extractPageStructure(page);

      await context.close();

      return {
        ...structure,
        globalAssertionsCode: this.buildGlobalAssertionsCode(structure),
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  async findBestLocatorForStep(params: {
    url: string;
    stepAction: string;
    scenarioTitle?: string;
  }): Promise<SmartLocatorResult> {
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: {
          width: 1366,
          height: 768,
        },
      });

      const page = await context.newPage();

      await page.goto(params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const pageStructure = await this.extractPageStructure(page);
      const globalAssertionsCode = this.buildGlobalAssertionsCode(pageStructure);

      const elements = await this.extractVisibleElements(page);
      const targetText = this.extractTargetText(
        params.stepAction,
        params.scenarioTitle,
      );

      if (!targetText) {
        await context.close();

        return {
          found: false,
          recommendedLocator: null,
          recommendedActionCode: null,
          recommendedAssertionCode: null,
          globalAssertionsCode,
          destinationAssertionsCode: [],
          alternatives: [],
          matchedText: null,
          elementType: null,
        };
      }

      const matchedElement = this.findBestMatchingElement(elements, targetText);

      if (!matchedElement) {
        await context.close();

        return {
          found: false,
          recommendedLocator: null,
          recommendedActionCode: null,
          recommendedAssertionCode: null,
          globalAssertionsCode,
          destinationAssertionsCode:
            this.buildFallbackDestinationAssertionsCode(targetText),
          alternatives: [],
          matchedText: targetText,
          elementType: null,
        };
      }

      const alternatives = this.buildLocatorCandidates(matchedElement);
      const recommended = alternatives[0];

      const recommendedAssertionCode = this.buildAssertionCode(
        matchedElement,
        targetText,
      );

      const destinationAssertionsCode = this.buildDestinationAssertionsCode(
        matchedElement,
        targetText,
      );

      await context.close();

      return {
        found: Boolean(recommended),
        recommendedLocator: recommended?.locator ?? null,
        recommendedActionCode: recommended
          ? this.buildActionCode(params.stepAction, recommended.locator)
          : null,
        recommendedAssertionCode,
        globalAssertionsCode,
        destinationAssertionsCode,
        alternatives,
        matchedText: matchedElement.text || targetText,
        elementType: matchedElement.tagName,
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private extractPageStructure(
    page: Page,
  ): Promise<Omit<PageStructureResult, 'globalAssertionsCode'>> {
    return page.evaluate(() => {
      const isVisible = (selector: string): boolean => {
        const element = document.querySelector(selector);
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        );
      };

      const logoSelectors = [
        'img[alt*="logo" i]',
        'img[src*="logo" i]',
        '[aria-label*="logo" i]',
        'svg[aria-label*="logo" i]',
        '.logo',
        '#logo',
        '[class*="logo" i]',
        '[id*="logo" i]',
      ];

      const logoSelector =
        logoSelectors.find((selector) => isVisible(selector)) || null;

      return {
        hasBody: Boolean(document.body),
        hasHeader: isVisible('header'),
        hasNav: isVisible('nav'),
        hasFooter: isVisible('footer'),
        hasMain: isVisible('main'),
        hasLogo: Boolean(logoSelector),
        logoLocator: logoSelector
          ? `page.locator('${logoSelector.replace(/'/g, "\\'")}').first()`
          : null,
      };
    });
  }

  private buildGlobalAssertionsCode(
    structure: Omit<PageStructureResult, 'globalAssertionsCode'>,
  ): string[] {
    const assertions: string[] = [];

    if (structure.hasBody) {
      assertions.push(`await expect(page.locator('body')).toBeVisible();`);
    }

    if (structure.hasHeader || structure.hasNav) {
      assertions.push(
        `await expect(page.locator('header, nav').first()).toBeVisible();`,
      );
    }

    if (structure.hasMain) {
      assertions.push(`await expect(page.locator('main')).toBeVisible();`);
    }

    if (structure.hasFooter) {
      assertions.push(`await expect(page.locator('footer')).toBeVisible();`);
    }

    if (structure.hasLogo && structure.logoLocator) {
      assertions.push(`await expect(${structure.logoLocator}).toBeVisible();`);
    }

    return assertions;
  }

  private extractVisibleElements(
    page: Page,
  ): Promise<PageElement[]> {
    return page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          'a, button, input, textarea, select, section, main, header, footer, nav, h1, h2, h3, [role], [data-testid]',
        ),
      );

      return nodes
        .map((el: Element) => {
          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const style = window.getComputedStyle(htmlEl);

          const isVisible =
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';

          if (!isVisible) return null;

          return {
            tagName: htmlEl.tagName.toLowerCase(),
            text: (htmlEl.innerText || htmlEl.textContent || '').trim(),
            role: htmlEl.getAttribute('role'),
            id: htmlEl.getAttribute('id'),
            name: htmlEl.getAttribute('name'),
            testId:
              htmlEl.getAttribute('data-testid') ||
              htmlEl.getAttribute('data-test-id'),
            href: htmlEl.getAttribute('href'),
            placeholder: htmlEl.getAttribute('placeholder'),
            ariaLabel: htmlEl.getAttribute('aria-label'),
            isInsideNav: Boolean(htmlEl.closest('nav')),
          };
        })
        .filter((element): element is PageElement => element !== null);
    });
  }

  private extractTargetText(
    stepAction: string,
    scenarioTitle?: string,
  ): string | null {
    const source = `${stepAction || ''} ${scenarioTitle || ''}`;

    const navigationQuoted = source.match(
      /navigation\s+vers\s+["'«]([^"'»]+)["'»]/i,
    );
    if (navigationQuoted?.[1]) return navigationQuoted[1].trim();

    const verifierNavigationQuoted = source.match(
      /v[eé]rifier\s+la\s+navigation\s+vers\s+["'«]([^"'»]+)["'»]/i,
    );
    if (verifierNavigationQuoted?.[1]) {
      return verifierNavigationQuoted[1].trim();
    }

    const allQuoted = [
      ...source.matchAll(/"([^"]+)"/g),
      ...source.matchAll(/'([^']+)'/g),
      ...source.matchAll(/«([^»]+)»/g),
    ]
      .map((match) => match[1]?.trim())
      .filter(Boolean);

    if (allQuoted.length > 0) {
      const bestQuoted = allQuoted
        .map((value) => this.extractLastMeaningfulTarget(value))
        .filter(Boolean)
        .sort((a, b) => a.length - b.length)[0];

      if (bestQuoted) return bestQuoted;
    }

    const navigationMatch = source.match(
      /navigation\s+vers\s+([a-zA-ZÀ-ÿ0-9\s_-]+)/i,
    );
    if (navigationMatch?.[1]) {
      return this.cleanTargetText(navigationMatch[1]);
    }

    const clickMatch = source.match(
      /cliquer\s+sur\s+(?:le|la|l'|un|une)?\s*(?:lien|bouton|élément|element)?\s*([a-zA-ZÀ-ÿ0-9\s_-]+)/i,
    );
    if (clickMatch?.[1]) {
      return this.cleanTargetText(clickMatch[1]);
    }

    return null;
  }

  private extractLastMeaningfulTarget(value: string): string {
    const quotedNavigation = value.match(
      /navigation\s+vers\s+["'«]?([^"'»]+)["'»]?/i,
    );
    if (quotedNavigation?.[1]) return this.cleanTargetText(quotedNavigation[1]);

    const words = value.trim().split(/\s+/);

    if (words.length <= 3) {
      return this.cleanTargetText(value);
    }

    return this.cleanTargetText(words[words.length - 1]);
  }

  private cleanTargetText(value: string): string {
    return value
      .replace(/[.!?;:]+$/g, '')
      .replace(/^["'«]+|["'»]+$/g, '')
      .replace(/v[eé]rifier/gi, '')
      .replace(/navigation/gi, '')
      .replace(/vers/gi, '')
      .trim();
  }

  private findBestMatchingElement(
    elements: PageElement[],
    targetText: string,
  ): PageElement | null {
    const normalizedTarget = this.normalize(targetText);

    const scored = elements
      .map((element) => {
        const searchableText = [
          element.text,
          element.ariaLabel,
          element.placeholder,
          element.id,
          element.name,
          element.href,
        ]
          .filter(Boolean)
          .join(' ');

        const normalizedElementText = this.normalize(searchableText);

        let score = 0;

        if (normalizedElementText === normalizedTarget) score += 100;
        if (normalizedElementText.includes(normalizedTarget)) score += 80;
        if (normalizedTarget.includes(normalizedElementText)) score += 50;

        if (element.tagName === 'a') score += 15;
        if (element.tagName === 'button') score += 15;
        if (element.tagName === 'section') score += 20;
        if (['h1', 'h2', 'h3'].includes(element.tagName)) score += 18;
        if (element.isInsideNav) score += 25;
        if (element.role) score += 10;
        if (element.testId) score += 20;
        if (element.id && this.isStableId(element.id)) score += 10;

        const normalizedHref = this.normalize(element.href || '');
        const slugTarget = this.toSlug(targetText);

        if (element.href === `#${slugTarget}`) score += 60;
        if (element.id === slugTarget) score += 60;
        if (normalizedHref.includes(slugTarget)) score += 35;

        return {
          element,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.element ?? null;
  }

  private buildLocatorCandidates(element: PageElement): LocatorCandidate[] {
    const candidates: LocatorCandidate[] = [];

    const visibleName =
      element.ariaLabel || element.text || element.placeholder || element.name;

    if (element.tagName === 'a' && element.href?.startsWith('#')) {
      const href = this.escapeString(element.href);

      if (element.isInsideNav) {
        candidates.push({
          locator: `page.locator('nav a[href="${href}"]')`,
          type: 'css',
          score: 99,
          reason:
            'Lien de navigation avec href ancre détecté. Très précis et évite les doublons.',
        });
      }

      candidates.push({
        locator: `page.locator('a[href="${href}"]').first()`,
        type: 'css',
        score: 94,
        reason:
          'Lien avec href ancre détecté. first() évite strict mode si le lien existe plusieurs fois.',
      });
    }

    if (element.testId) {
      candidates.push({
        locator: `page.getByTestId('${this.escapeString(element.testId)}')`,
        type: 'testid',
        score: 92,
        reason: 'data-testid détecté, très stable pour les tests.',
      });
    }

    if (element.tagName === 'a' && visibleName) {
      candidates.push({
        locator: `page.getByRole('link', { name: /${this.escapeRegex(
          visibleName,
        )}/i }).first()`,
        type: 'role',
        score: 88,
        reason:
          'Lien détecté avec texte visible. first() évite strict mode en cas de doublon.',
      });
    }

    if (element.tagName === 'button' && visibleName) {
      candidates.push({
        locator: `page.getByRole('button', { name: /${this.escapeRegex(
          visibleName,
        )}/i }).first()`,
        type: 'role',
        score: 88,
        reason:
          'Bouton détecté avec nom accessible. first() évite strict mode en cas de doublon.',
      });
    }

    if (
      ['input', 'textarea', 'select'].includes(element.tagName) &&
      element.placeholder
    ) {
      candidates.push({
        locator: `page.getByPlaceholder('${this.escapeString(
          element.placeholder,
        )}')`,
        type: 'text',
        score: 90,
        reason: 'Champ détecté avec placeholder.',
      });
    }

    if (element.id && this.isStableId(element.id)) {
      candidates.push({
        locator: `page.locator('#${this.escapeCssIdentifier(element.id)}')`,
        type: 'id',
        score: 88,
        reason: 'ID stable détecté.',
      });
    }

    if (element.name) {
      candidates.push({
        locator: `page.locator('[name="${this.escapeString(element.name)}"]')`,
        type: 'name',
        score: 82,
        reason: 'Attribut name détecté.',
      });
    }

    if (element.text) {
      candidates.push({
        locator: `page.getByText(/${this.escapeRegex(element.text)}/i).first()`,
        type: 'text',
        score: 75,
        reason:
          'Texte visible détecté. first() évite strict mode si le texte est répété.',
      });
    }

    if (element.href && !element.href.startsWith('#')) {
      candidates.push({
        locator: `page.locator('a[href="${this.escapeString(
          element.href,
        )}"]').first()`,
        type: 'css',
        score: 80,
        reason: 'Lien détecté avec href.',
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  private buildActionCode(stepAction: string, locator: string): string {
    const normalized = this.normalize(stepAction);

    if (
      normalized.includes('cliquer') ||
      normalized.includes('click') ||
      normalized.includes('navigation') ||
      normalized.includes('lien') ||
      normalized.includes('redirig')
    ) {
      return `await ${locator}.click();`;
    }

    if (
      normalized.includes('verifier') ||
      normalized.includes('vérifier') ||
      normalized.includes('afficher') ||
      normalized.includes('visible')
    ) {
      return `await expect(${locator}).toBeVisible();`;
    }

    return `await expect(${locator}).toBeVisible();`;
  }

  private buildDestinationAssertionsCode(
    element: PageElement,
    targetText: string,
  ): string[] {
    const assertions: string[] = [];
    const primaryAssertion = this.buildAssertionCode(element, targetText);

    if (primaryAssertion) {
      assertions.push(primaryAssertion);
    }

    if (element.tagName === 'a' && element.href?.startsWith('#')) {
      const sectionId = element.href.replace('#', '').trim();

      if (sectionId) {
        const targetTitle = targetText.trim();

        assertions.push(
          `await expect(page.locator('#${this.escapeCssIdentifier(
            sectionId,
          )}')).toBeVisible();`,
        );

        if (targetTitle) {
          assertions.push(
            `await expect(page.locator('#${this.escapeCssIdentifier(
              sectionId,
            )}').getByText(/${this.escapeRegex(
              targetTitle,
            )}/i).first()).toBeVisible();`,
          );
        }
      }
    }

    return this.deduplicate(assertions);
  }

  private buildFallbackDestinationAssertionsCode(targetText: string): string[] {
    const assertions: string[] = [];

    if (targetText) {
      assertions.push(
        `await expect(page.getByText(/${this.escapeRegex(
          targetText,
        )}/i).first()).toBeVisible();`,
      );
    }

    assertions.push(`await expect(page.locator('body')).toBeVisible();`);

    return this.deduplicate(assertions);
  }

  private buildAssertionCode(
    element: PageElement,
    targetText: string,
  ): string | null {
    if (element.tagName === 'a' && element.href?.startsWith('#')) {
      const sectionId = element.href.replace('#', '').trim();

      if (sectionId) {
        return `await expect(page.locator('#${this.escapeCssIdentifier(
          sectionId,
        )}')).toBeVisible();`;
      }
    }

    if (element.id && this.isStableId(element.id)) {
      return `await expect(page.locator('#${this.escapeCssIdentifier(
        element.id,
      )}')).toBeVisible();`;
    }

    if (targetText) {
      return `await expect(page.getByText(/${this.escapeRegex(
        targetText,
      )}/i).first()).toBeVisible();`;
    }

    return null;
  }

  private deduplicate(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toSlug(value: string): string {
    return this.normalize(value)
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private isStableId(id: string): boolean {
    const unstablePatterns = [
      /^mui-/i,
      /^radix-/i,
      /^react-select-/i,
      /^headlessui-/i,
      /^ember/i,
      /^generated/i,
      /:r\d+:/i,
      /\d{4,}/,
    ];

    return !unstablePatterns.some((pattern) => pattern.test(id));
  }

  private escapeString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private escapeRegex(value: string): string {
    return value
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
  }

  private escapeCssIdentifier(value: string): string {
    return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }
}
