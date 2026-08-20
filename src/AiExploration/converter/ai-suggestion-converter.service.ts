import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AIGenerationMode,
  Prisma,
  AISuggestionStatus,
  AutomationFramework,
  TestCaseSourceType,
  TestCaseStatus,
  TestPriority,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ConvertAISuggestionDto = {
  suiteId?: string;
  suiteName?: string;
  generatePlaywrightCode?: boolean;
};

type GeneratedStep = {
  action: string;
  expected?: string;
};

type ScenarioType =
  | 'PAGE'
  | 'FIELD'
  | 'BUTTON'
  | 'LINK'
  | 'FORM'
  | 'CONSOLE'
  | 'GENERIC';

@Injectable()
export class AISuggestionConverterService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async convertSuggestionToTestCase(
    suggestionId: string,
    dto: ConvertAISuggestionDto = {},
  ) {
    const suggestion =
      await this.prisma.aITestSuggestion.findUnique({
        where: {
          id: suggestionId,
        },
        include: {
          exploration: {
            include: {
              project: true,
            },
          },
          convertedTestCases: {
            include: {
              suite: true,
              steps: {
                orderBy: {
                  stepOrder: 'asc',
                },
              },
            },
          },
        },
      });

    if (!suggestion) {
      throw new NotFoundException(
        'AI suggestion not found',
      );
    }

    if (
      suggestion.status ===
      AISuggestionStatus.CONVERTED
    ) {
      const existing =
        suggestion.convertedTestCases[0];

      if (existing) {
        return {
          message: 'Suggestion already converted',
          testCase: existing,
        };
      }
    }

    const exploration = suggestion.exploration;

    if (!exploration.projectId) {
      throw new BadRequestException(
        'Exploration project is missing',
      );
    }

    const suite = dto.suiteId
      ? await this.findSuite(dto.suiteId)
      : await this.findOrCreateAISuite({
          projectId: exploration.projectId,
          suiteName:
            dto.suiteName ||
            `IA - Exploration ${this.cleanSuiteName(
              exploration.title ||
                exploration.targetUrl ||
                'Application',
            )}`,
          generationMode:
            exploration.generationMode ||
            AIGenerationMode.RULE_BASED,
        });

    if (
      suite.projectId !== exploration.projectId
    ) {
      throw new BadRequestException(
        'Selected suite does not belong to the exploration project',
      );
    }

    const aiGeneratedSteps = this.readGeneratedSteps(
      suggestion.steps,
    );

    const steps =
      aiGeneratedSteps.length > 0
        ? aiGeneratedSteps
        : this.buildStepsFromSuggestion({
            title: suggestion.title,
            description:
              suggestion.description || '',
            expectedResult:
              suggestion.expectedResult || '',
            targetUrl: exploration.targetUrl || '',
          });

    const shouldGeneratePlaywright =
      dto.generatePlaywrightCode ?? true;

    const automationCode =
      shouldGeneratePlaywright
        ? this.buildPlaywrightCode({
            title: suggestion.title,
            description:
              suggestion.description || '',
            targetUrl:
              exploration.targetUrl || '',
            steps,
            expectedResult:
              suggestion.expectedResult || '',
          })
        : undefined;

    const priority = this.mapPriority(
      suggestion.priority,
    );

    const testCase =
      await this.prisma.testCase.create({
        data: {
          suiteId: suite.id,
          title: suggestion.title,
          description: this.buildTestCaseDescription({
            description: suggestion.description,
            gherkin: suggestion.gherkin,
          }),
          expected:
            suggestion.expectedResult ||
            undefined,

          status: TestCaseStatus.DRAFT,
          priority,

          sourceType:
            TestCaseSourceType.AI_GENERATED,
          generationMode:
            exploration.generationMode ||
            AIGenerationMode.RULE_BASED,
          automationFramework:
            shouldGeneratePlaywright
              ? AutomationFramework.PLAYWRIGHT
              : undefined,
          automationCode,

          aiSuggestionId: suggestion.id,

          steps: {
            create: steps.map(
              (step, index) => ({
                stepOrder: index + 1,
                action: step.action,
                expected: step.expected,
              }),
            ),
          },
        },
        include: {
          suite: true,
          steps: {
            orderBy: {
              stepOrder: 'asc',
            },
          },
          aiSuggestion: true,
        },
      });

    await this.prisma.aITestSuggestion.update({
      where: {
        id: suggestion.id,
      },
      data: {
        status:
          AISuggestionStatus.CONVERTED,
      },
    });

    const updatedTestCase =
      await this.prisma.testCase.findUnique({
        where: {
          id: testCase.id,
        },
        include: {
          suite: true,
          steps: {
            orderBy: {
              stepOrder: 'asc',
            },
          },
          aiSuggestion: true,
        },
      });

    return {
      message:
        'Suggestion converted successfully',
      testCase: updatedTestCase,
    };
  }

  private async findSuite(
    suiteId: string,
  ) {
    const suite =
      await this.prisma.testSuite.findUnique({
        where: {
          id: suiteId,
        },
      });

    if (!suite) {
      throw new NotFoundException(
        'Test suite not found',
      );
    }

    return suite;
  }

  private async findOrCreateAISuite(input: {
    projectId: string;
    suiteName: string;
    generationMode: AIGenerationMode;
  }) {
    const existing =
      await this.prisma.testSuite.findFirst({
        where: {
          projectId: input.projectId,
          name: input.suiteName,
        },
      });

    if (existing) {
      return existing;
    }

    return this.prisma.testSuite.create({
      data: {
        projectId: input.projectId,
        name: input.suiteName,
        description:
          `Suite générée automatiquement depuis IA Explorer - Stratégie ${input.generationMode}.`,
      },
    });
  }

  private readGeneratedSteps(value: Prisma.JsonValue | null): GeneratedStep[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.slice(0, 20).reduce<GeneratedStep[]>((steps, item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return steps;
      }

      const action =
        typeof item.action === 'string'
          ? item.action.trim().slice(0, 1_000)
          : '';
      const expected =
        typeof item.expected === 'string'
          ? item.expected.trim().slice(0, 1_000)
          : '';

      if (!action) {
        return steps;
      }

      steps.push({
        action,
        ...(expected ? { expected } : {}),
      });

      return steps;
    }, []);
  }

  private buildTestCaseDescription(input: {
    description?: string | null;
    gherkin?: string | null;
  }) {
    const description =
      input.description?.trim() ||
      'Cas de test généré automatiquement depuis IA Explorer.';
    const gherkin = input.gherkin?.trim();

    if (!gherkin) {
      return description;
    }

    return `${description}

Scénario Gherkin proposé par SMART-QA :
${gherkin}`;
  }

  private buildStepsFromSuggestion(input: {
    title: string;
    description: string;
    expectedResult: string;
    targetUrl: string;
  }): GeneratedStep[] {
    const scenarioType =
      this.detectScenarioType(input);
    const targetName =
      this.extractTargetName(input.title);

    const steps: GeneratedStep[] = [];

    steps.push({
      action: input.targetUrl
        ? `Ouvrir l'application : ${input.targetUrl}`
        : "Ouvrir l'application à tester.",
      expected: input.targetUrl
        ? 'La page doit se charger correctement.'
        : "L'application doit être accessible.",
    });

    switch (scenarioType) {
      case 'FIELD':
        steps.push({
          action: `Localiser précisément le champ "${targetName}".`,
          expected:
            'Le champ doit être visible et activé.',
        });
        steps.push({
          action: `Saisir une valeur valide dans le champ "${targetName}".`,
          expected:
            'La valeur saisie doit être conservée par le champ.',
        });
        break;

      case 'BUTTON':
        steps.push({
          action: `Localiser puis cliquer sur le bouton "${targetName}".`,
          expected:
            "Le bouton doit déclencher l'action prévue.",
        });
        break;

      case 'LINK':
        steps.push({
          action: `Localiser puis cliquer sur le lien "${targetName}".`,
          expected:
            "L'utilisateur doit être redirigé vers la destination attendue.",
        });
        break;

      case 'FORM':
        steps.push({
          action:
            'Localiser le formulaire et renseigner ses champs visibles avec des valeurs valides.',
          expected:
            'Les champs doivent accepter les valeurs saisies.',
        });
        steps.push({
          action:
            'Soumettre le formulaire à l’aide de son bouton de validation.',
          expected:
            'Le formulaire doit être traité sans erreur bloquante.',
        });
        break;

      case 'CONSOLE':
        steps.push({
          action:
            'Surveiller explicitement les erreurs JavaScript de la console pendant le chargement.',
          expected:
            'Aucune erreur JavaScript critique ne doit être détectée.',
        });
        break;

      case 'PAGE':
        steps.push({
          action:
            'Vérifier que le document principal est visible et que le titre de la page est défini.',
          expected:
            'La page doit afficher son contenu principal.',
        });
        break;

      case 'GENERIC':
      default:
        steps.push({
          action:
            input.description ||
            `Exécuter le scénario : "${input.title}".`,
          expected:
            input.expectedResult ||
            'Le comportement obtenu doit être conforme au résultat attendu.',
        });
        break;
    }

    steps.push({
      action:
        'Vérifier le résultat final du scénario.',
      expected:
        input.expectedResult ||
        'Le résultat obtenu doit correspondre au comportement attendu.',
    });

    return steps;
  }

  private buildPlaywrightCode(input: {
    title: string;
    description: string;
    targetUrl: string;
    steps: GeneratedStep[];
    expectedResult: string;
  }) {
    const lines: string[] = [];
    const scenarioType =
      this.detectScenarioType(input);
    const targetName =
      this.extractTargetName(input.title);
    const targetPattern =
      this.escapeRegex(targetName);
    const targetToken =
      this.toSearchToken(targetName);
    const testValue =
      this.getTestValue(targetName);

    lines.push(
      `import { test, expect } from '@playwright/test';`,
    );
    lines.push('');
    lines.push(
      `test('${this.escape(
        input.title,
      )}', async ({ page }) => {`,
    );

    if (scenarioType === 'CONSOLE') {
      lines.push(
        `  const consoleErrors = [];`,
      );
      lines.push('');
      lines.push(
        `  page.on('console', (message) => {`,
      );
      lines.push(
        `    if (message.type() === 'error') {`,
      );
      lines.push(
        `      consoleErrors.push(message.text());`,
      );
      lines.push(`    }`);
      lines.push(`  });`);
      lines.push('');
    }

    if (input.targetUrl) {
      lines.push(
        `  await page.goto('${this.escape(
          input.targetUrl,
        )}', {`,
      );
      lines.push(
        `    waitUntil: 'domcontentloaded',`,
      );
      lines.push(`  });`);
    } else {
      lines.push(
        `  throw new Error('Target URL is missing for this generated test.');`,
      );
    }

    lines.push('');
    lines.push(
      `  await expect(page.locator('body')).toBeVisible();`,
    );

    switch (scenarioType) {
      case 'FIELD':
        lines.push('');
        lines.push(
          `  const targetField = page`,
        );
        lines.push(
          `    .getByLabel(/${targetPattern}/i)`,
        );
        lines.push(
          `    .or(page.getByPlaceholder(/${targetPattern}/i))`,
        );
        lines.push(
          `    .or(`,
        );
        lines.push(
          `      page.locator(`,
        );
        lines.push(
          `        'input[name*="${targetToken}" i], textarea[name*="${targetToken}" i], input[id*="${targetToken}" i], textarea[id*="${targetToken}" i]',`,
        );
        lines.push(`      ),`);
        lines.push(`    )`);
        lines.push(`    .first();`);
        lines.push('');
        lines.push(
          `  await expect(targetField).toBeVisible();`,
        );
        lines.push(
          `  await expect(targetField).toBeEnabled();`,
        );
        lines.push(
          `  await targetField.fill('${this.escape(
            testValue,
          )}');`,
        );
        lines.push(
          `  await expect(targetField).toHaveValue('${this.escape(
            testValue,
          )}');`,
        );
        break;

      case 'BUTTON':
        lines.push('');
        lines.push(
          `  const targetButton = page`,
        );
        lines.push(
          `    .getByRole('button', { name: /${targetPattern}/i })`,
        );
        lines.push(
          `    .or(page.getByText(/${targetPattern}/i))`,
        );
        lines.push(`    .first();`);
        lines.push('');
        lines.push(
          `  await expect(targetButton).toBeVisible();`,
        );
        lines.push(
          `  await expect(targetButton).toBeEnabled();`,
        );
        lines.push(
          `  await targetButton.click();`,
        );
        lines.push(
          `  await expect(page.locator('body')).toBeVisible();`,
        );
        break;

      case 'LINK':
        lines.push('');
        lines.push(
          `  const targetLink = page`,
        );
        lines.push(
          `    .getByRole('link', { name: /${targetPattern}/i })`,
        );
        lines.push(
          `    .or(page.getByText(/${targetPattern}/i))`,
        );
        lines.push(`    .first();`);
        lines.push('');
        lines.push(
          `  await expect(targetLink).toBeVisible();`,
        );
        lines.push(
          `  await targetLink.click();`,
        );
        lines.push(
          `  await page.waitForLoadState('domcontentloaded');`,
        );
        lines.push(
          `  await expect(page.locator('body')).toBeVisible();`,
        );
        break;

      case 'FORM':
        lines.push('');
        lines.push(
          `  const form = page.locator('form').first();`,
        );
        lines.push(
          `  await expect(form).toBeVisible();`,
        );
        lines.push('');
        lines.push(
          `  const visibleFields = form.locator('input:not([type="hidden"]), textarea');`,
        );
        lines.push(
          `  const fieldCount = await visibleFields.count();`,
        );
        lines.push('');
        lines.push(
          `  for (let index = 0; index < fieldCount; index += 1) {`,
        );
        lines.push(
          `    const field = visibleFields.nth(index);`,
        );
        lines.push(
          `    const fieldType = await field.getAttribute('type');`,
        );
        lines.push(
          `    if (fieldType === 'checkbox' || fieldType === 'radio' || fieldType === 'submit') {`,
        );
        lines.push(`      continue;`);
        lines.push(`    }`);
        lines.push(
          `    await field.fill('Valeur de test');`,
        );
        lines.push(`  }`);
        lines.push('');
        lines.push(
          `  const submitButton = form.getByRole('button', {`,
        );
        lines.push(
          `    name: /envoyer|soumettre|valider|submit/i,`,
        );
        lines.push(`  }).first();`);
        lines.push(
          `  await expect(submitButton).toBeVisible();`,
        );
        lines.push(
          `  await submitButton.click();`,
        );
        lines.push(
          `  await expect(page.locator('body')).toBeVisible();`,
        );
        break;

      case 'CONSOLE':
        lines.push('');
        lines.push(
          `  expect(consoleErrors).toHaveLength(0);`,
        );
        break;

      case 'PAGE':
        lines.push(
          `  await expect(page).toHaveTitle(/.+/);`,
        );
        break;

      case 'GENERIC':
      default:
        lines.push(
          `  await expect(page.locator('body')).toBeVisible();`,
        );
        break;
    }

    if (input.expectedResult) {
      lines.push('');
      lines.push(
        `  // Résultat attendu : ${this.escapeComment(
          input.expectedResult,
        )}`,
      );
    }

    lines.push(`});`);

    return lines.join('\n');
  }

  private detectScenarioType(input: {
    title: string;
    description?: string;
    expectedResult?: string;
    steps?: GeneratedStep[];
  }): ScenarioType {
    const title =
      input.title.toLowerCase();
    const description =
      input.description?.toLowerCase() || '';

    if (
      /\b(console|javascript)\b/.test(title) ||
      /\berreurs?\s+(console|javascript)\b/.test(
        description,
      )
    ) {
      return 'CONSOLE';
    }

    if (
      title.includes('champ') ||
      title.includes('input')
    ) {
      return 'FIELD';
    }

    if (
      title.includes('bouton') ||
      title.includes('button')
    ) {
      return 'BUTTON';
    }

    if (
      title.includes('navigation') ||
      title.includes('lien') ||
      title.includes('link') ||
      title.includes('redirig')
    ) {
      return 'LINK';
    }

    if (
      title.includes('formulaire') ||
      title.includes('soumission')
    ) {
      return 'FORM';
    }

    if (
      title.includes('chargement') ||
      title.includes('page')
    ) {
      return 'PAGE';
    }

    return 'GENERIC';
  }

  private extractTargetName(
    title: string,
  ) {
    const quoted =
      title.match(/["“”']([^"“”']+)["“”']/);

    const rawValue =
      quoted?.[1] ||
      title
        .replace(
          /vérifier|controler|contrôler|champ|bouton|lien|navigation|action/gi,
          ' ',
        )
        .trim();

    return rawValue
      .replace(/\s*\*+\s*$/g, '')
      .trim() || 'élément';
  }

  private getTestValue(
    fieldName: string,
  ) {
    const normalized =
      this.toSearchToken(fieldName);

    if (
      normalized.includes('email') ||
      normalized.includes('courriel')
    ) {
      return 'test@example.com';
    }

    if (
      normalized.includes('telephone') ||
      normalized.includes('phone') ||
      normalized.includes('tel')
    ) {
      return '20123456';
    }

    if (
      normalized.includes('prenom') ||
      normalized.includes('firstname')
    ) {
      return 'Mohsen';
    }

    if (
      normalized === 'nom' ||
      normalized.includes('lastname')
    ) {
      return 'Test';
    }

    if (normalized.includes('sujet')) {
      return 'Demande de test';
    }

    if (
      normalized.includes('message') ||
      normalized.includes('commentaire')
    ) {
      return 'Message de test automatisé';
    }

    return 'Valeur de test';
  }

  private mapPriority(
    priority: string,
  ): TestPriority {
    switch (priority) {
      case 'LOW':
        return TestPriority.LOW;
      case 'HIGH':
        return TestPriority.HIGH;
      case 'CRITICAL':
        return TestPriority.CRITICAL;
      case 'MEDIUM':
      default:
        return TestPriority.MEDIUM;
    }
  }

  private cleanSuiteName(
    value: string,
  ) {
    return value
      .replace(/^https?:\/\//, '')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .slice(0, 80);
  }

  private toSearchToken(
    value: string,
  ) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private escapeRegex(
    value: string,
  ) {
    return value.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
  }

  private escape(
    value: string,
  ) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
  }

  private escapeComment(
    value: string,
  ) {
    return value
      .replace(/\n/g, ' ')
      .replace(/\*\//g, '');
  }
}
