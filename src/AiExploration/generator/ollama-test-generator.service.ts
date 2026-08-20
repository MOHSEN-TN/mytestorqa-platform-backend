import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AITestPrioritizerService } from '../prioritization/ai-test-prioritizer.service';
import { OllamaService } from '../ollama/ollama.service';
import { SMART_QA_TEST_GENERATION_SYSTEM_PROMPT } from '../prompts/smart-qa.prompt';
import { AIGenerationResult } from './ai-test-generator.types';
import {
  OLLAMA_SAFE_SNAPSHOT_PROFILE,
  OLLAMA_SNAPSHOT_PROFILE,
  RawGeneratedPayload,
  TestGenerationInput,
  buildTestGenerationPrompt,
  collectAllowedUrls,
  compactExplorationSnapshot,
  normalizeGeneratedSuggestions,
  parseGeneratedPayload,
} from './shared/test-generation.shared';

@Injectable()
export class OllamaTestGeneratorService {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly prioritizerService: AITestPrioritizerService,
  ) {}

  getModelName() {
    return this.ollamaService.getModelName();
  }

  async generate(
    input: TestGenerationInput,
  ): Promise<AIGenerationResult> {
    const maxSuggestions = this.readMaxSuggestions();
    const snapshot = compactExplorationSnapshot(
      input.explorationResult,
      {
        ...OLLAMA_SNAPSHOT_PROFILE,
        maxCharacters: this.readSnapshotMaxCharacters(),
      },
    );

    try {
      return await this.generateWithSnapshot({
        input,
        snapshot,
        maxSuggestions,
        format: 'json',
        outputMode: 'JSON',
        numCtx: this.readNumCtx(),
        numPredict: this.readNumPredict(),
        attempt: 1,
      });
    } catch (firstError) {
      if (
        !this.safeRetryEnabled() ||
        !this.shouldUseSafeRetry(firstError)
      ) {
        throw firstError;
      }

      const ready = await this.ollamaService.waitUntilReady(
        this.readRecoveryWaitMs(),
      );

      if (!ready) {
        throw new ServiceUnavailableException(
          `Ollama n’est pas redevenu disponible après la première tentative. ` +
            `Détail initial : ${this.errorMessage(firstError)}`,
        );
      }

      const safeSnapshot = compactExplorationSnapshot(
        input.explorationResult,
        OLLAMA_SAFE_SNAPSHOT_PROFILE,
      );

      try {
        return await this.generateWithSnapshot({
          input,
          snapshot: safeSnapshot,
          maxSuggestions: Math.min(3, maxSuggestions),
          format: undefined,
          outputMode: 'PROMPT_JSON',
          numCtx: Math.min(4_096, this.readNumCtx()),
          numPredict: Math.min(768, this.readNumPredict()),
          attempt: 2,
        });
      } catch (safeError) {
        throw new ServiceUnavailableException(
          `Ollama n’a pas pu générer les suggestions, y compris en mode sûr. ` +
            `Première tentative : ${this.errorMessage(firstError)}. ` +
            `Mode sûr : ${this.errorMessage(safeError)}`,
        );
      }
    }
  }

  private async generateWithSnapshot(input: {
    input: TestGenerationInput;
    snapshot: ReturnType<typeof compactExplorationSnapshot>;
    maxSuggestions: number;
    format: 'json' | undefined;
    outputMode: 'JSON' | 'PROMPT_JSON';
    numCtx: number;
    numPredict: number;
    attempt: number;
  }): Promise<AIGenerationResult> {
    const prompt = buildTestGenerationPrompt(
      input.input,
      input.snapshot,
      input.maxSuggestions,
      'Ollama local',
    );

    const response = await this.ollamaService.chat({
      messages: [
        {
          role: 'system',
          content: SMART_QA_TEST_GENERATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      format: input.format,
      temperature: 0.1,
      numPredict: input.numPredict,
      numCtx: input.numCtx,
      timeoutMs: this.readTimeoutMs(),
      think: false,
      purpose: 'TEST_GENERATION',
      seed: 42,
    });

    let payload: RawGeneratedPayload;

    try {
      payload = parseGeneratedPayload(
        response.content,
        'Ollama',
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        this.errorMessage(error),
      );
    }

    const suggestions = normalizeGeneratedSuggestions(
      payload.suggestions,
      collectAllowedUrls(
        input.snapshot,
        input.input.targetUrl,
      ),
      input.input,
      this.prioritizerService,
      input.maxSuggestions,
    );

    if (suggestions.length === 0) {
      throw new ServiceUnavailableException(
        'Ollama n’a produit aucune suggestion SMART-QA exploitable.',
      );
    }

    return {
      suggestions,
      metrics: {
        model: response.model,
        promptTokens: response.metrics.promptTokens,
        completionTokens: response.metrics.completionTokens,
        totalDurationMs: response.metrics.totalDurationMs,
        requestAttempts: input.attempt,
        snapshotCharacters: JSON.stringify(input.snapshot).length,
        outputMode: input.outputMode,
      },
    };
  }

  private shouldUseSafeRetry(error: unknown) {
    const message = this.errorMessage(error).toLowerCase();

    return [
      'failed to parse grammar',
      'invalid grammar',
      'fetch failed',
      'econnreset',
      'socket',
      'terminated',
      'connection closed',
      'http 500',
      'http 502',
      'http 503',
      'http 504',
      'réponse vide',
      'réponse json',
    ].some((pattern) => message.includes(pattern));
  }

  private readNumPredict() {
    return this.readInteger(
      process.env.OLLAMA_TEST_NUM_PREDICT,
      1_024,
      256,
      8_192,
    );
  }

  private readNumCtx() {
    return this.readInteger(
      process.env.OLLAMA_TEST_NUM_CTX ||
        process.env.OLLAMA_NUM_CTX,
      4_096,
      2_048,
      32_768,
    );
  }

  private readTimeoutMs() {
    return this.readInteger(
      process.env.OLLAMA_TEST_TIMEOUT_MS ||
        process.env.OLLAMA_TIMEOUT_MS,
      600_000,
      30_000,
      1_200_000,
    );
  }

  private readSnapshotMaxCharacters() {
    return this.readInteger(
      process.env.OLLAMA_TEST_MAX_SNAPSHOT_CHARS,
      OLLAMA_SNAPSHOT_PROFILE.maxCharacters,
      3_000,
      30_000,
    );
  }

  private readMaxSuggestions() {
    return this.readInteger(
      process.env.OLLAMA_TEST_MAX_SUGGESTIONS,
      5,
      1,
      10,
    );
  }

  private readRecoveryWaitMs() {
    return this.readInteger(
      process.env.OLLAMA_RECOVERY_WAIT_MS,
      20_000,
      2_000,
      120_000,
    );
  }

  private safeRetryEnabled() {
    const raw = process.env.OLLAMA_TEST_SAFE_RETRY;

    if (raw === undefined) {
      return true;
    }

    return ['true', '1', 'yes', 'on'].includes(
      raw.trim().toLowerCase(),
    );
  }

  private readInteger(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = Number(raw);

    if (!Number.isInteger(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Erreur inconnue';
  }
}
