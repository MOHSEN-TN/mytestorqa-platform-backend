import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GeminiChatInput,
  GeminiChatResult,
  GeminiStatus,
} from './gemini.types';

type GeminiModelResponse = {
  name?: string;
  version?: string;
  displayName?: string;
};

type GeminiGenerateContentResponse = {
  modelVersion?: string;
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type GoogleApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GeminiHttpError';
  }
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);

  private readonly baseUrl = this.normalizeBaseUrl(
    process.env.GEMINI_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta',
  );

  private readonly configuredModel = this.normalizeModelName(
    process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  );

  private readonly apiKey = process.env.GEMINI_API_KEY?.trim() || '';

  private readonly defaultTimeoutMs = this.readInteger(
    process.env.GEMINI_TIMEOUT_MS,
    120_000,
    5_000,
    600_000,
  );

  private readonly defaultMaxOutputTokens = this.readInteger(
    process.env.GEMINI_MAX_OUTPUT_TOKENS,
    4_096,
    256,
    65_536,
  );

  private readonly maxRetries = this.readInteger(
    process.env.GEMINI_MAX_RETRIES,
    1,
    0,
    3,
  );

  private readonly statusCacheMs = this.readInteger(
    process.env.GEMINI_STATUS_CACHE_MS,
    300_000,
    10_000,
    3_600_000,
  );

  private statusCache:
    | {
        value: GeminiStatus;
        expiresAt: number;
      }
    | undefined;

  private statusPromise: Promise<GeminiStatus> | undefined;

  onModuleInit() {
    void this.logInitialStatus();
  }

  getModelName() {
    return this.configuredModel;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async getStatus(force = false): Promise<GeminiStatus> {
    if (!this.apiKey) {
      return {
        available: false,
        configured: false,
        configuredModel: this.configuredModel,
        error:
          'GEMINI_API_KEY est absente. Ajoutez-la uniquement dans le fichier .env du backend.',
      };
    }

    const now = Date.now();

    if (!force && this.statusCache && this.statusCache.expiresAt > now) {
      return this.statusCache.value;
    }

    if (this.statusPromise !== undefined) {
      return this.statusPromise;
    }

    this.statusPromise = this.loadStatus().finally(() => {
      this.statusPromise = undefined;
    });

    return this.statusPromise;
  }

  async chat(input: GeminiChatInput): Promise<GeminiChatResult> {
    this.assertConfigured();

    const model = this.normalizeModelName(
      input.model || this.configuredModel,
    );
    const startedAt = Date.now();
    const systemInstruction = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join('\n\n');
    const contents = this.buildContents(input.messages);

    if (contents.length === 0) {
      throw new ServiceUnavailableException(
        'Aucun message utilisateur exploitable n’a été fourni à Gemini.',
      );
    }

    // Gemini 3.x : conserver les paramètres d'échantillonnage par défaut.
    // On n'envoie que le budget de sortie et, si demandé, le format structuré.
    const baseGenerationConfig = {
      maxOutputTokens:
        input.maxOutputTokens ?? this.defaultMaxOutputTokens,
    };

    const generationConfig = input.responseSchema
      ? {
          ...baseGenerationConfig,
          responseFormat: {
            text: {
              mimeType: 'application/json',
              schema: input.responseSchema,
            },
          },
        }
      : baseGenerationConfig;

    const body = {
      ...(systemInstruction
        ? {
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
      contents,
      generationConfig,
    };

    let response: GeminiGenerateContentResponse;

    try {
      try {
        response = await this.requestJson<GeminiGenerateContentResponse>(
          `/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
          input.timeoutMs ?? this.defaultTimeoutMs,
        );
      } catch (primaryError) {
        // Sur un 400 avec JSON Schema, essayer l'ancien contrat REST.
        // L'API peut répondre seulement "Request contains an invalid argument"
        // sans nommer le champ fautif, donc on ne dépend plus du texte de l'erreur.
        if (!input.responseSchema || !this.isBadRequest(primaryError)) {
          throw primaryError;
        }

        this.logger.warn(
          `Gemini responseFormat refusé pour ${model}; tentative responseJsonSchema.`,
        );

        const legacyBody = {
          ...(systemInstruction
            ? {
                systemInstruction: {
                  parts: [{ text: systemInstruction }],
                },
              }
            : {}),
          contents,
          generationConfig: {
            ...baseGenerationConfig,
            responseMimeType: 'application/json',
            responseJsonSchema: input.responseSchema,
          },
        };

        try {
          response = await this.requestJson<GeminiGenerateContentResponse>(
            `/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(legacyBody),
            },
            input.timeoutMs ?? this.defaultTimeoutMs,
          );
        } catch (legacyError) {
          if (!this.isBadRequest(legacyError)) {
            throw legacyError;
          }

          // Dernier mode sûr : JSON sans schéma côté fournisseur.
          // La réponse reste parsée, normalisée et validée côté backend SMART-QA.
          this.logger.warn(
            `Gemini JSON Schema refusé pour ${model}; tentative JSON simple avec validation backend.`,
          );

          const jsonOnlyBody = {
            ...(systemInstruction
              ? {
                  systemInstruction: {
                    parts: [{ text: systemInstruction }],
                  },
                }
              : {}),
            contents,
            generationConfig: {
              ...baseGenerationConfig,
              responseMimeType: 'application/json',
            },
          };

          response = await this.requestJson<GeminiGenerateContentResponse>(
            `/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(jsonOnlyBody),
            },
            input.timeoutMs ?? this.defaultTimeoutMs,
          );
        }
      }
    } catch (error) {
      throw this.toServiceException(error);
    }

    const candidate = response.candidates?.[0];
    const content = (candidate?.content?.parts || [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text?.trim() || '')
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!content) {
      const blocked =
        response.promptFeedback?.blockReasonMessage ||
        response.promptFeedback?.blockReason;

      throw new ServiceUnavailableException(
        blocked
          ? `Gemini a bloqué la réponse : ${blocked}`
          : 'Gemini a retourné une réponse vide pour SMART-QA.',
      );
    }

    return {
      model,
      content,
      doneReason: candidate?.finishReason,
      metrics: {
        totalDurationMs: Date.now() - startedAt,
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount,
        totalTokens: response.usageMetadata?.totalTokenCount,
      },
    };
  }

  private async loadStatus(): Promise<GeminiStatus> {
    try {
      const model = await this.requestJson<GeminiModelResponse>(
        `/models/${encodeURIComponent(this.configuredModel)}`,
        { method: 'GET' },
        15_000,
      );

      const value: GeminiStatus = {
        available: true,
        configured: true,
        configuredModel: this.configuredModel,
        apiVersion: model.version,
        displayName: model.displayName,
      };

      this.statusCache = {
        value,
        expiresAt: Date.now() + this.statusCacheMs,
      };

      return value;
    } catch (error) {
      const value: GeminiStatus = {
        available: false,
        configured: true,
        configuredModel: this.configuredModel,
        error: this.errorMessage(error),
      };

      this.statusCache = {
        value,
        expiresAt: Date.now() + Math.min(this.statusCacheMs, 30_000),
      };

      return value;
    }
  }

  private buildContents(messages: GeminiChatInput['messages']) {
    const normalized = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        text: message.content.trim(),
      }))
      .filter((message) => message.text.length > 0);

    return normalized.reduce<
      Array<{ role: string; parts: Array<{ text: string }> }>
    >((contents, message) => {
      const previous = contents[contents.length - 1];

      if (previous?.role === message.role) {
        previous.parts[0].text = `${previous.parts[0].text}\n\n${message.text}`;
        return contents;
      }

      contents.push({
        role: message.role,
        parts: [{ text: message.text }],
      });

      return contents;
    }, []);
  }

  private assertConfigured() {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Gemini n’est pas configuré. Définissez GEMINI_API_KEY dans le .env du backend.',
      );
    }
  }

  private isBadRequest(error: unknown) {
    return error instanceof GeminiHttpError && error.status === 400;
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const headers = new Headers(init.headers);
        headers.set('x-goog-api-key', this.apiKey);

        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
        const text = await response.text();

        if (!response.ok) {
          const message =
            this.readGoogleError(text) ||
            `Gemini API a répondu HTTP ${response.status}.`;
          const retryAfterSeconds = this.readRetryAfterSeconds(response);
          const httpError = new GeminiHttpError(
            response.status,
            message,
            retryAfterSeconds,
          );

          // Un quota 429 ne doit pas être retenté immédiatement : cela gaspille
          // du temps et ne réinitialise pas la fenêtre de quota.
          if (
            attempt < this.maxRetries &&
            response.status >= 500
          ) {
            lastError = httpError;
            await this.sleep(350 * 2 ** attempt);
            continue;
          }

          throw httpError;
        }

        if (!text.trim()) {
          throw new ServiceUnavailableException(
            'Gemini API a retourné une réponse HTTP vide.',
          );
        }

        return JSON.parse(text) as T;
      } catch (error) {
        if (
          error instanceof GeminiHttpError ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }

        if (this.isAbortError(error)) {
          throw new GatewayTimeoutException(
            `Gemini n’a pas répondu dans le délai de ${timeoutMs} ms.`,
          );
        }

        lastError = error;

        if (attempt < this.maxRetries) {
          await this.sleep(350 * 2 ** attempt);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException(
      `SMART-QA ne peut pas joindre Gemini. Détail : ${this.errorMessage(lastError)}`,
    );
  }

  private readRetryAfterSeconds(response: Response) {
    const header = response.headers.get('retry-after');
    const value = Number(header);

    if (Number.isFinite(value) && value >= 0) {
      return Math.ceil(value);
    }

    return undefined;
  }

  private readGoogleError(text: string) {
    if (!text.trim()) {
      return '';
    }

    try {
      const payload = JSON.parse(text) as GoogleApiErrorPayload & {
        error?: {
          details?: Array<{
            fieldViolations?: Array<{
              field?: string;
              description?: string;
            }>;
          }>;
        };
      };

      const message = payload.error?.message?.trim() || '';
      const violations = (payload.error?.details || [])
        .flatMap((detail) => detail.fieldViolations || [])
        .map((violation) =>
          [violation.field, violation.description].filter(Boolean).join(': '),
        )
        .filter(Boolean);

      return [message, ...violations].filter(Boolean).join(' | ') || text.slice(0, 1_500);
    } catch {
      return text.slice(0, 1_500);
    }
  }

  private async logInitialStatus() {
    const status = await this.getStatus(true);

    if (status.available) {
      this.logger.log(
        `Gemini disponible : ${status.configuredModel}${
          status.apiVersion ? ` (${status.apiVersion})` : ''
        }`,
      );
      return;
    }

    if (status.configured) {
      this.logger.warn(
        `Gemini indisponible : ${status.error || 'erreur inconnue'}`,
      );
      return;
    }

    this.logger.log('Gemini non configuré : GEMINI_API_KEY absente.');
  }

  private normalizeBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, '');
  }

  private normalizeModelName(value: string) {
    const normalized = value.trim().replace(/^models\//i, '');
    return normalized || 'gemini-3.6-flash';
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

  private isAbortError(error: unknown) {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'))
    );
  }

  private toServiceException(error: unknown) {
    if (
      error instanceof GatewayTimeoutException ||
      error instanceof ServiceUnavailableException ||
      error instanceof HttpException
    ) {
      return error;
    }

    if (error instanceof GeminiHttpError) {
      if (error.status === 429) {
        const retryMessage = error.retryAfterSeconds
          ? ` Réessayez dans environ ${error.retryAfterSeconds} seconde(s).`
          : '';

        return new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: 'GEMINI_QUOTA_EXCEEDED',
            message:
              `Quota Gemini atteint pour le modèle ${this.configuredModel}.` +
              retryMessage,
            providerMessage: error.message,
            retryAfterSeconds: error.retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return new ServiceUnavailableException(
        `Gemini API est indisponible (HTTP ${error.status}) : ${error.message}`,
      );
    }

    return new ServiceUnavailableException(
      `SMART-QA ne peut pas utiliser Gemini. Détail : ${this.errorMessage(error)}`,
    );
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

  private sleep(durationMs: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }
}
