import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';
import { SMART_QA_TEST_GENERATION_SYSTEM_PROMPT } from '../prompts/smart-qa.prompt';
import { AITestPrioritizerService } from '../prioritization/ai-test-prioritizer.service';
import { AIGenerationResult } from './ai-test-generator.types';
import {
  GEMINI_SNAPSHOT_PROFILE,
  TEST_GENERATION_SCHEMA,
  RawGeneratedPayload,
  TestGenerationInput,
  buildTestGenerationPrompt,
  collectAllowedUrls,
  compactExplorationSnapshot,
  normalizeGeneratedSuggestions,
  parseGeneratedPayload,
} from './shared/test-generation.shared';

@Injectable()
export class GeminiTestGeneratorService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly prioritizerService: AITestPrioritizerService,
  ) {}

  getModelName() {
    return this.geminiService.getModelName();
  }

  async generate(input: TestGenerationInput): Promise<AIGenerationResult> {
    const maxSuggestions = this.readMaxSuggestions();

    const snapshot = compactExplorationSnapshot(
      input.explorationResult,
      {
        ...GEMINI_SNAPSHOT_PROFILE,
        maxCharacters: this.readSnapshotMaxCharacters(),
      },
    );

    const prompt = buildTestGenerationPrompt(
      input,
      snapshot,
      maxSuggestions,
      'Gemini Cloud',
    );

    const response = await this.geminiService.chat({
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
      responseSchema: TEST_GENERATION_SCHEMA,
      temperature: this.readTemperature(),
      maxOutputTokens: this.readMaxOutputTokens(),
      timeoutMs: this.readTimeoutMs(),
    });

    let payload: RawGeneratedPayload;

    try {
      payload = parseGeneratedPayload(
        response.content,
        'Gemini',
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        this.errorMessage(error),
      );
    }

    const suggestions = normalizeGeneratedSuggestions(
      payload.suggestions,
      collectAllowedUrls(snapshot, input.targetUrl),
      input,
      this.prioritizerService,
      maxSuggestions,
    );

    if (suggestions.length === 0) {
      throw new ServiceUnavailableException(
        'Gemini n’a produit aucune suggestion SMART-QA exploitable.',
      );
    }

    return {
      suggestions,
      metrics: {
        model: response.model,
        promptTokens: response.metrics.promptTokens,
        completionTokens: response.metrics.completionTokens,
        totalDurationMs: response.metrics.totalDurationMs,
        requestAttempts: 1,
        snapshotCharacters: JSON.stringify(snapshot).length,
        outputMode: 'JSON_SCHEMA',
      },
    };
  }

  private readMaxOutputTokens() {
    return this.readInteger(
      process.env.GEMINI_TEST_MAX_OUTPUT_TOKENS,
      4_096,
      1_024,
      16_384,
    );
  }

  private readTimeoutMs() {
    return this.readInteger(
      process.env.GEMINI_TEST_TIMEOUT_MS,
      180_000,
      10_000,
      600_000,
    );
  }

  private readSnapshotMaxCharacters() {
    return this.readInteger(
      process.env.GEMINI_TEST_MAX_SNAPSHOT_CHARS,
      GEMINI_SNAPSHOT_PROFILE.maxCharacters,
      5_000,
      80_000,
    );
  }

  private readMaxSuggestions() {
    return this.readInteger(
      process.env.GEMINI_TEST_MAX_SUGGESTIONS,
      5,
      1,
      10,
    );
  }

  private readTemperature() {
    const value = Number(
      process.env.GEMINI_TEST_TEMPERATURE,
    );

    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.min(2, Math.max(0, value));
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
