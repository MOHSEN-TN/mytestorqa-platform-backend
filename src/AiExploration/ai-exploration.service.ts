import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AIGenerationMode,
  AIExplorationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlaywrightExplorerService } from '../automation/playwright/playwright-explorer.service';
import type { ExplorationResult } from '../automation/playwright/playwright.types';
import { AITestGeneratorService } from './generator/ai-test-generator.service';
import { GeminiTestGeneratorService } from './generator/gemini-test-generator.service';
import { OllamaTestGeneratorService } from './generator/ollama-test-generator.service';
import {
  AIGenerationResult,
  GeneratedAISuggestion,
} from './generator/ai-test-generator.types';

export type CreateAIExplorationDto = {
  projectId: string;
  createdById?: string;

  title: string;
  prompt?: string;
  context?: string;
  generationMode?: AIGenerationMode;

  targetUrl?: string;
  depth?: number;

  authenticationRequired?: boolean;
  username?: string;
  password?: string;

  generatePlaywright?: boolean;
  generateGherkin?: boolean;
  generateNegativeTests?: boolean;
};

export type UpdateAIExplorationDto = Partial<CreateAIExplorationDto> & {
  status?: AIExplorationStatus;
};

const EXPLORATION_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
  suggestions: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

@Injectable()
export class AIExplorationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playwrightExplorerService: PlaywrightExplorerService,
    private readonly aiTestGeneratorService: AITestGeneratorService,
    private readonly ollamaTestGeneratorService: OllamaTestGeneratorService,
    private readonly geminiTestGeneratorService: GeminiTestGeneratorService,
  ) {}

  private readonly activeGenerations = new Set<string>();

  async findAll() {
    const explorations = await this.prisma.aIExploration.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: EXPLORATION_INCLUDE,
    });

    return explorations.map((exploration) =>
      this.sanitizeExploration(exploration),
    );
  }

  async findAllByUser(createdById: string) {
    const explorations = await this.prisma.aIExploration.findMany({
      where: {
        createdById,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: EXPLORATION_INCLUDE,
    });

    return explorations.map((exploration) =>
      this.sanitizeExploration(exploration),
    );
  }

  async findByProject(projectId: string) {
    const explorations = await this.prisma.aIExploration.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: EXPLORATION_INCLUDE,
    });

    return explorations.map((exploration) =>
      this.sanitizeExploration(exploration),
    );
  }

  async findOne(id: string) {
    const exploration = await this.findOneRaw(id);

    return this.sanitizeExploration(exploration);
  }

  async create(dto: CreateAIExplorationDto) {
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required');
    }

    if (!dto.createdById) {
      throw new BadRequestException('createdById is required');
    }

    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('title is required');
    }

    const project = await this.prisma.project.findUnique({
      where: {
        id: dto.projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.createdById,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const generationMode =
      dto.generationMode ?? AIGenerationMode.RULE_BASED;

    const prompt =
      dto.prompt ||
      this.buildPromptFromExplorerOptions({
        title: dto.title,
        targetUrl: dto.targetUrl,
        depth: dto.depth,
        authenticationRequired: dto.authenticationRequired,
        generatePlaywright: dto.generatePlaywright,
        generateGherkin: dto.generateGherkin,
        generateNegativeTests: dto.generateNegativeTests,
        context: dto.context,
        generationMode,
      });

    const exploration = await this.prisma.aIExploration.create({
      data: {
        projectId: dto.projectId,
        createdById: dto.createdById,

        title: dto.title.trim(),
        prompt,
        context: dto.context,
        generationMode,

        targetUrl: dto.targetUrl,
        depth: dto.depth ?? 1,

        authenticationRequired: dto.authenticationRequired ?? false,
        username: dto.username,
        password: dto.password,

        generatePlaywright: dto.generatePlaywright ?? true,
        generateGherkin: dto.generateGherkin ?? true,
        generateNegativeTests: dto.generateNegativeTests ?? false,

        status: AIExplorationStatus.DRAFT,
        generatedCount: 0,
        aiModel: this.resolveConfiguredModel(generationMode),
      },
      include: EXPLORATION_INCLUDE,
    });

    return this.sanitizeExploration(exploration);
  }

  async update(id: string, dto: UpdateAIExplorationDto) {
    await this.findOneRaw(id);

    const invalidateSnapshot = [
      dto.targetUrl,
      dto.depth,
      dto.authenticationRequired,
      dto.username,
      dto.password,
    ].some((value) => value !== undefined);

    const exploration = await this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        title: dto.title?.trim(),
        prompt: dto.prompt,
        context: dto.context,
        generationMode: dto.generationMode,

        targetUrl: dto.targetUrl,
        depth: dto.depth,

        authenticationRequired: dto.authenticationRequired,
        username: dto.username,
        password: dto.password,

        generatePlaywright: dto.generatePlaywright,
        generateGherkin: dto.generateGherkin,
        generateNegativeTests: dto.generateNegativeTests,
        explorationSnapshot: invalidateSnapshot ? Prisma.DbNull : undefined,

        status: dto.status,
        aiModel: dto.generationMode
          ? this.resolveConfiguredModel(dto.generationMode)
          : undefined,
      },
      include: EXPLORATION_INCLUDE,
    });

    return this.sanitizeExploration(exploration);
  }

  async remove(id: string) {
    await this.findOneRaw(id);

    const exploration = await this.prisma.aIExploration.delete({
      where: {
        id,
      },
      include: EXPLORATION_INCLUDE,
    });

    return this.sanitizeExploration(exploration);
  }

  async generate(id: string) {
    if (this.activeGenerations.has(id)) {
      throw new ConflictException(
        'Une génération SMART-QA est déjà en cours pour cette exploration.',
      );
    }

    this.activeGenerations.add(id);
    const startedAt = Date.now();

    try {
      const exploration = await this.findOneRaw(id);

      if (!exploration.targetUrl) {
        throw new BadRequestException(
          'targetUrl is required for generation',
        );
      }

      await this.prisma.aIExploration.update({
        where: { id },
        data: {
          status: AIExplorationStatus.PROCESSING,
          lastError: null,
          fallbackUsed: false,
        },
      });

      const explorationResult = await this.resolveExplorationSnapshot(
        exploration,
      );

      // Le snapshot Playwright est sauvegardé avant l'appel IA. Ainsi, un quota
      // Gemini ou une erreur Ollama ne force pas une nouvelle exploration.
      await this.prisma.aIExploration.update({
        where: { id },
        data: {
          explorationSnapshot: this.toJson(explorationResult),
        },
      });

      let generationResult: AIGenerationResult;
      let fallbackUsed = false;
      let fallbackError: string | null = null;

      if (exploration.generationMode === AIGenerationMode.OLLAMA_LOCAL) {
        try {
          generationResult = await this.ollamaTestGeneratorService.generate({
            title: exploration.title,
            prompt: exploration.prompt,
            context: exploration.context,
            targetUrl: exploration.targetUrl,
            generatePlaywright: exploration.generatePlaywright,
            generateGherkin: exploration.generateGherkin,
            generateNegativeTests: exploration.generateNegativeTests,
            explorationResult,
          });
        } catch (error) {
          if (!this.shouldFallbackToRules(AIGenerationMode.OLLAMA_LOCAL)) {
            throw error;
          }

          fallbackUsed = true;
          fallbackError =
            `Ollama indisponible, génération de secours par règles : ` +
            this.errorMessage(error);
          generationResult = {
            suggestions: this.generateRuleBasedSuggestions(
              explorationResult,
              exploration,
            ),
          };
        }
      } else if (
        exploration.generationMode === AIGenerationMode.CLOUD_AI
      ) {
        try {
          generationResult = await this.geminiTestGeneratorService.generate({
            title: exploration.title,
            prompt: exploration.prompt,
            context: exploration.context,
            targetUrl: exploration.targetUrl,
            generatePlaywright: exploration.generatePlaywright,
            generateGherkin: exploration.generateGherkin,
            generateNegativeTests: exploration.generateNegativeTests,
            explorationResult,
          });
        } catch (error) {
          if (!this.shouldFallbackToRules(AIGenerationMode.CLOUD_AI)) {
            throw error;
          }

          fallbackUsed = true;
          fallbackError =
            `Gemini indisponible, génération de secours par règles : ` +
            this.errorMessage(error);
          generationResult = {
            suggestions: this.generateRuleBasedSuggestions(
              explorationResult,
              exploration,
            ),
          };
        }
      } else {
        generationResult = {
          suggestions: this.generateRuleBasedSuggestions(
            explorationResult,
            exploration,
          ),
        };
      }

      if (generationResult.suggestions.length === 0) {
        throw new BadRequestException(
          'Aucune suggestion de test n’a pu être générée.',
        );
      }

      const generationDurationMs = Date.now() - startedAt;

      await this.prisma.$transaction(async (transaction) => {
        await transaction.aITestSuggestion.deleteMany({
          where: { explorationId: id },
        });

        await transaction.aITestSuggestion.createMany({
          data: generationResult.suggestions.map((suggestion) =>
            this.toSuggestionCreateData(id, suggestion),
          ),
        });

        await transaction.aIExploration.update({
          where: { id },
          data: {
            status: AIExplorationStatus.GENERATED,
            generatedCount: generationResult.suggestions.length,
            explorationSnapshot: this.toJson(explorationResult),
            aiModel: fallbackUsed
              ? null
              : generationResult.metrics?.model ||
                this.resolveConfiguredModel(exploration.generationMode),
            generationDurationMs,
            promptTokens: generationResult.metrics?.promptTokens,
            completionTokens: generationResult.metrics?.completionTokens,
            ollamaTotalDurationMs:
              exploration.generationMode === AIGenerationMode.OLLAMA_LOCAL
                ? generationResult.metrics?.totalDurationMs
                : null,
            lastGeneratedAt: new Date(),
            lastError: fallbackError,
            fallbackUsed,
          },
        });
      });

      return this.findOne(id);
    } catch (error) {
      await this.prisma.aIExploration
        .update({
          where: { id },
          data: {
            status: AIExplorationStatus.FAILED,
            lastError: this.errorMessage(error).slice(0, 4_000),
            generationDurationMs: Date.now() - startedAt,
            fallbackUsed: false,
          },
        })
        .catch(() => undefined);

      throw error;
    } finally {
      this.activeGenerations.delete(id);
    }
  }

  private async resolveExplorationSnapshot(exploration: {
    targetUrl: string | null;
    depth: number;
    authenticationRequired: boolean;
    username: string | null;
    password: string | null;
    explorationSnapshot: Prisma.JsonValue | null;
  }): Promise<ExplorationResult> {
    if (
      this.shouldReuseSnapshot() &&
      this.isExplorationResult(exploration.explorationSnapshot)
    ) {
      return exploration.explorationSnapshot;
    }

    if (!exploration.targetUrl) {
      throw new BadRequestException(
        'targetUrl is required for exploration',
      );
    }

    return this.playwrightExplorerService.explore({
      targetUrl: exploration.targetUrl,
      depth: exploration.depth ?? 1,
      authenticationRequired: exploration.authenticationRequired ?? false,
      username: exploration.username ?? undefined,
      password: exploration.password ?? undefined,
    });
  }

  private isExplorationResult(
    value: Prisma.JsonValue | null,
  ): value is ExplorationResult {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
      typeof candidate.startUrl === 'string' &&
      typeof candidate.depth === 'number' &&
      Array.isArray(candidate.pages) &&
      Array.isArray(candidate.errors)
    );
  }

  private shouldReuseSnapshot() {
    const raw = process.env.SMART_QA_REUSE_EXPLORATION_SNAPSHOT;

    if (raw === undefined) {
      return true;
    }

    return ['1', 'true', 'yes', 'oui', 'on'].includes(
      raw.trim().toLowerCase(),
    );
  }

  async validate(id: string) {
    await this.findOneRaw(id);

    const exploration = await this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        status: AIExplorationStatus.VALIDATED,
      },
      include: EXPLORATION_INCLUDE,
    });

    return this.sanitizeExploration(exploration);
  }

  async archive(id: string) {
    await this.findOneRaw(id);

    const exploration = await this.prisma.aIExploration.update({
      where: {
        id,
      },
      data: {
        status: AIExplorationStatus.ARCHIVED,
      },
      include: EXPLORATION_INCLUDE,
    });

    return this.sanitizeExploration(exploration);
  }

  private async findOneRaw(id: string) {
    const exploration = await this.prisma.aIExploration.findUnique({
      where: {
        id,
      },
      include: EXPLORATION_INCLUDE,
    });

    if (!exploration) {
      throw new NotFoundException('AI exploration not found');
    }

    return exploration;
  }

  private generateRuleBasedSuggestions(
    explorationResult: Parameters<
      AITestGeneratorService['generateFromExploration']
    >[0],
    exploration: {
      generatePlaywright: boolean;
      generateGherkin: boolean;
      generateNegativeTests: boolean;
    },
  ) {
    return this.aiTestGeneratorService.generateFromExploration(
      explorationResult,
      {
        generatePlaywright: exploration.generatePlaywright,
        generateGherkin: exploration.generateGherkin,
        generateNegativeTests: exploration.generateNegativeTests,
      },
    );
  }

  private toSuggestionCreateData(
    explorationId: string,
    suggestion: GeneratedAISuggestion,
  ): Prisma.AITestSuggestionCreateManyInput {
    return {
      explorationId,
      title: suggestion.title,
      description: suggestion.description,
      expectedResult: suggestion.expectedResult,
      priority: suggestion.priority,
      sourcePageUrl: suggestion.sourcePageUrl,
      aiConfidence: suggestion.aiConfidence,
      gherkin: suggestion.gherkin,
      ...(suggestion.steps
        ? { steps: this.toJson(suggestion.steps) }
        : {}),
    };
  }

  private sanitizeExploration<T extends Record<string, unknown>>(
    exploration: T,
  ) {
    const {
      password,
      username,
      explorationSnapshot,
      ...safe
    } = exploration;

    void password;
    void username;
    void explorationSnapshot;

    return safe;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private shouldFallbackToRules(mode: AIGenerationMode) {
    const envName =
      mode === AIGenerationMode.CLOUD_AI
        ? 'GEMINI_FALLBACK_TO_RULES'
        : 'OLLAMA_FALLBACK_TO_RULES';
    const raw = process.env[envName]?.trim().toLowerCase();

    if (!raw) {
      return mode === AIGenerationMode.OLLAMA_LOCAL;
    }

    return ['1', 'true', 'yes', 'oui'].includes(raw);
  }

  private resolveConfiguredModel(mode: AIGenerationMode) {
    if (mode === AIGenerationMode.OLLAMA_LOCAL) {
      return this.ollamaTestGeneratorService.getModelName();
    }

    if (mode === AIGenerationMode.CLOUD_AI) {
      return this.geminiTestGeneratorService.getModelName();
    }

    return null;
  }

  private errorMessage(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    return typeof error === 'string' ? error : 'Erreur inconnue';
  }

  private buildPromptFromExplorerOptions(options: {
    title: string;
    targetUrl?: string;
    depth?: number;
    authenticationRequired?: boolean;
    generatePlaywright?: boolean;
    generateGherkin?: boolean;
    generateNegativeTests?: boolean;
    context?: string;
    generationMode: AIGenerationMode;
  }) {
    return `
Génère des scénarios de test QA pour l’application suivante.

Titre : ${options.title}
Mode de génération : ${options.generationMode}
URL cible : ${options.targetUrl || 'Non fournie'}
Profondeur d’exploration : ${options.depth ?? 1}
Authentification requise : ${options.authenticationRequired ? 'Oui' : 'Non'}
Générer des tests Playwright : ${options.generatePlaywright ?? true}
Générer des scénarios Gherkin : ${options.generateGherkin ?? true}
Inclure des tests négatifs : ${options.generateNegativeTests ?? false}
Contexte additionnel : ${options.context || 'Aucun'}
`.trim();
  }
}
