import {
  GatewayTimeoutException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OllamaChatInput,
  OllamaChatResult,
  OllamaModelSummary,
  OllamaStatus,
} from './ollama.types';

type OllamaVersionResponse = {
  version?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
    size?: number;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
};

type OllamaChatResponse = {
  model?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

class OllamaHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OllamaHttpError';
  }
}

@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly logger = new Logger(OllamaService.name);

  private readonly baseUrl = this.normalizeBaseUrl(
    process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  );

  /**
   * Le profil FAST est prioritaire pour la machine locale.
   * Si OLLAMA_MODEL_FAST est absent, le service conserve la compatibilité
   * avec l'ancienne variable OLLAMA_MODEL.
   */
  private readonly configuredModel =
    process.env.OLLAMA_MODEL_FAST?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    'qwen2.5-coder:3b';

  private readonly defaultTimeoutMs = this.readInteger(
    process.env.OLLAMA_TIMEOUT_MS,
    300_000,
    5_000,
    1_200_000,
  );

  private readonly keepAlive = this.normalizeKeepAlive(
    process.env.OLLAMA_KEEP_ALIVE,
  );

  private readonly defaultNumCtx = this.readInteger(
    process.env.OLLAMA_NUM_CTX,
    4_096,
    2_048,
    32_768,
  );

  private readonly defaultTemperature = this.readNumber(
    process.env.OLLAMA_TEMPERATURE,
    0.05,
    0,
    2,
  );

  private readonly defaultNumPredict = this.readInteger(
    process.env.OLLAMA_NUM_PREDICT,
    768,
    64,
    4_096,
  );

  private readonly maxRetries = this.readInteger(
    process.env.OLLAMA_MAX_RETRIES,
    0,
    0,
    3,
  );

  private readonly statusCacheMs = this.readInteger(
    process.env.OLLAMA_STATUS_CACHE_MS,
    60_000,
    5_000,
    600_000,
  );

  private readonly serializeRequests = this.readBoolean(
    process.env.OLLAMA_SERIALIZE_REQUESTS,
    true,
  );

  /**
   * Désactivé par défaut pour qwen2.5-coder:3b.
   * Le champ "think" n'est envoyé que si le modèle le supporte
   * et si l'appel le demande explicitement.
   */
  private readonly thinkingEnabled = this.readBoolean(
    process.env.OLLAMA_ENABLE_THINKING,
    false,
  );

  private modelAvailabilityCache:
    | {
        model: string;
        installed: boolean;
        expiresAt: number;
      }
    | undefined;

  private statusCache:
    | {
        value: OllamaStatus;
        expiresAt: number;
      }
    | undefined;

  private statusPromise: Promise<OllamaStatus> | undefined;
  private requestTail: Promise<void> = Promise.resolve();
  private activeRequests = 0;

  onModuleInit() {
    void this.logInitialStatus();
  }

  getModelName() {
    return this.configuredModel;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  isBusy() {
    return this.activeRequests > 0;
  }

  async getStatus(force = false): Promise<OllamaStatus> {
    const now = Date.now();

    if (!force && this.statusCache && this.statusCache.expiresAt > now) {
      return {
        ...this.statusCache.value,
        busy: this.isBusy(),
      };
    }

    /*
     * Une génération locale peut monopoliser le CPU plusieurs minutes.
     * On évite alors d'envoyer des appels /api/version et /api/tags inutiles.
     */
    if (this.isBusy() && this.statusCache) {
      return {
        ...this.statusCache.value,
        busy: true,
      };
    }

    if (this.statusPromise !== undefined) {
      return this.statusPromise;
    }

    this.statusPromise = this.loadStatus().finally(() => {
      this.statusPromise = undefined;
    });

    return this.statusPromise;
  }

  async listModels(): Promise<OllamaModelSummary[]> {
    const response = await this.requestJson<OllamaTagsResponse>(
      '/api/tags',
      { method: 'GET' },
      15_000,
    );

    return (response.models || [])
      .map((item) => ({
        name: item.name || item.model || '',
        model: item.model,
        size: item.size,
        parameterSize: item.details?.parameter_size,
        quantizationLevel: item.details?.quantization_level,
      }))
      .filter((item) => item.name.length > 0);
  }

  async chat(input: OllamaChatInput): Promise<OllamaChatResult> {
    const execute = () => this.executeChat(input);

    return this.serializeRequests ? this.runExclusive(execute) : execute();
  }

  async waitUntilReady(
    timeoutMs = 30_000,
    intervalMs = 1_000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
        const models = await this.listModels();

        if (this.isModelInstalled(this.configuredModel, models)) {
          this.modelAvailabilityCache = {
            model: this.configuredModel,
            installed: true,
            expiresAt: Date.now() + this.statusCacheMs,
          };
          return true;
        }
      } catch {
        // Ollama peut être en train de charger ou libérer le modèle.
      }

      await this.delay(intervalMs);
    }

    return false;
  }

  private async executeChat(input: OllamaChatInput): Promise<OllamaChatResult> {
    const model = input.model?.trim() || this.configuredModel;
    const messages = input.messages
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0);

    if (messages.length === 0) {
      throw new ServiceUnavailableException(
        'Aucun message exploitable n’a été fourni à Ollama.',
      );
    }

    await this.assertModelAvailable(model);

    const response = await this.requestChatStream(
      {
        model,
        messages,
        stream: true,
        keep_alive: this.keepAlive,

        /*
         * Ne pas envoyer "think: false" aux modèles qui ne gèrent pas
         * officiellement ce paramètre. Pour les modèles de raisonnement
         * compatibles, le champ est ajouté uniquement sur demande explicite.
         */
        ...(this.shouldEnableThinking(model, input.think)
          ? { think: true }
          : {}),

        ...(input.format ? { format: input.format } : {}),

        options: {
          temperature: input.temperature ?? this.defaultTemperature,
          num_ctx: input.numCtx ?? this.defaultNumCtx,
          num_predict: input.numPredict ?? this.defaultNumPredict,
          seed: input.seed ?? 42,
        },
      },
      input.timeoutMs ?? this.defaultTimeoutMs,
    );

    const content = response.message?.content?.trim();

    if (!content) {
      throw new ServiceUnavailableException(
        'Ollama a retourné une réponse vide pour SMART-QA.',
      );
    }

    return {
      model: response.model || model,
      content,
      doneReason: response.done_reason,
      metrics: {
        totalDurationMs: this.nanosecondsToMilliseconds(
          response.total_duration,
        ),
        loadDurationMs: this.nanosecondsToMilliseconds(
          response.load_duration,
        ),
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
      },
    };
  }

  private async loadStatus(): Promise<OllamaStatus> {
    try {
      const [version, models] = await Promise.all([
        this.requestJson<OllamaVersionResponse>(
          '/api/version',
          { method: 'GET' },
          10_000,
        ),
        this.listModels(),
      ]);

      const modelInstalled = this.isModelInstalled(
        this.configuredModel,
        models,
      );
      const checkedAt = new Date().toISOString();

      this.modelAvailabilityCache = {
        model: this.configuredModel,
        installed: modelInstalled,
        expiresAt: Date.now() + this.statusCacheMs,
      };

      const value: OllamaStatus = {
        available: true,
        version: version.version,
        configuredModel: this.configuredModel,
        modelInstalled,
        models,
        busy: this.isBusy(),
        checkedAt,
      };

      this.statusCache = {
        value,
        expiresAt: Date.now() + this.statusCacheMs,
      };

      return value;
    } catch (error) {
      const value: OllamaStatus = {
        available: false,
        configuredModel: this.configuredModel,
        modelInstalled: false,
        models: [],
        busy: this.isBusy(),
        checkedAt: new Date().toISOString(),
        error: this.errorMessage(error),
      };

      this.statusCache = {
        value,
        expiresAt: Date.now() + Math.min(this.statusCacheMs, 10_000),
      };

      return value;
    }
  }

  private async assertModelAvailable(model: string) {
    const cached = this.modelAvailabilityCache;

    if (
      cached &&
      cached.model === model &&
      cached.expiresAt > Date.now()
    ) {
      if (!cached.installed) {
        throw this.modelMissingException(model);
      }

      return;
    }

    let models: OllamaModelSummary[];

    try {
      models = await this.listModels();
    } catch (error) {
      throw new ServiceUnavailableException(
        `SMART-QA ne peut pas joindre Ollama sur ${this.baseUrl}. ` +
          `Vérifiez que l’application Ollama est lancée. Détail : ${this.errorMessage(
            error,
          )}`,
      );
    }

    const installed = this.isModelInstalled(model, models);

    this.modelAvailabilityCache = {
      model,
      installed,
      expiresAt: Date.now() + this.statusCacheMs,
    };

    if (!installed) {
      throw this.modelMissingException(model);
    }
  }

  private modelMissingException(model: string) {
    return new ServiceUnavailableException(
      `Le modèle Ollama "${model}" n’est pas installé. ` +
        `Exécutez : ollama pull ${model}`,
    );
  }

  private isModelInstalled(
    targetModel: string,
    models: OllamaModelSummary[],
  ) {
    const target = this.normalizeModelName(targetModel);

    return models.some((item) => {
      const names = [item.name, item.model].filter(
        (value): value is string => Boolean(value),
      );

      return names.some(
        (name) => this.normalizeModelName(name) === target,
      );
    });
  }

  private normalizeModelName(value: string) {
    const normalized = value.trim().toLowerCase();

    return normalized.endsWith(':latest')
      ? normalized.slice(0, -':latest'.length)
      : normalized;
  }

  private shouldEnableThinking(
    model: string,
    requested: boolean | undefined,
  ) {
    if (!this.thinkingEnabled || requested !== true) {
      return false;
    }

    const normalized = model.toLowerCase();

    return (
      normalized.includes('qwen3') ||
      normalized.includes('qwq') ||
      normalized.includes('deepseek-r1')
    );
  }

  /**
   * Le streaming force Ollama à envoyer rapidement les en-têtes HTTP
   * et les fragments NDJSON. Cela évite le timeout interne d'Undici
   * observé avec les générations CPU longues et stream=false.
   */
  private async requestChatStream(
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<OllamaChatResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson, application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        const parsed = text ? this.parseJsonSafely(text) : undefined;
        const detail = this.extractErrorDetail(parsed, text);

        throw new OllamaHttpError(
          response.status,
          `Ollama HTTP ${response.status}${detail ? ` : ${detail}` : ''}`,
        );
      }

      if (!response.body) {
        throw new Error('Ollama n’a retourné aucun flux de réponse.');
      }

      const contentType = response.headers.get('content-type') || '';

      /*
       * Certains proxys ou anciennes versions peuvent renvoyer un objet JSON
       * unique malgré stream=true. On conserve donc ce chemin de compatibilité.
       */
      if (
        contentType.includes('application/json') &&
        !contentType.includes('ndjson')
      ) {
        const text = await response.text();
        const parsed = this.parseJsonSafely(text);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Réponse JSON Ollama invalide.');
        }

        return parsed as OllamaChatResponse;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let model: string | undefined;
      let content = '';
      let thinking = '';
      let doneReason: string | undefined;
      let totalDuration: number | undefined;
      let loadDuration: number | undefined;
      let promptEvalCount: number | undefined;
      let evalCount: number | undefined;
      let receivedChunk = false;

      const consumeLine = (rawLine: string) => {
        const line = rawLine.trim();

        if (!line) {
          return;
        }

        const parsed = this.parseJsonSafely(line);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Chunk NDJSON Ollama invalide.');
        }

        const chunk = parsed as OllamaChatResponse;

        if (chunk.error) {
          throw new OllamaHttpError(500, `Ollama : ${chunk.error}`);
        }

        receivedChunk = true;
        model = chunk.model || model;
        content += chunk.message?.content || '';
        thinking += chunk.message?.thinking || '';
        doneReason = chunk.done_reason || doneReason;
        totalDuration = chunk.total_duration ?? totalDuration;
        loadDuration = chunk.load_duration ?? loadDuration;
        promptEvalCount = chunk.prompt_eval_count ?? promptEvalCount;
        evalCount = chunk.eval_count ?? evalCount;
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          consumeLine(line);
        }
      }

      buffer += decoder.decode();
      consumeLine(buffer);

      if (!receivedChunk) {
        throw new Error('Ollama n’a retourné aucun fragment exploitable.');
      }

      return {
        model,
        message: {
          role: 'assistant',
          content,
          ...(thinking ? { thinking } : {}),
        },
        done_reason: doneReason,
        total_duration: totalDuration,
        load_duration: loadDuration,
        prompt_eval_count: promptEvalCount,
        eval_count: evalCount,
      };
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new GatewayTimeoutException(
          `Ollama n’a pas répondu dans le délai de ${timeoutMs} ms.`,
        );
      }

      if (error instanceof OllamaHttpError) {
        throw new ServiceUnavailableException(error.message);
      }

      if (
        error instanceof ServiceUnavailableException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      throw new ServiceUnavailableException(
        `Impossible de communiquer avec Ollama sur ${this.baseUrl}. ` +
          this.errorMessage(error),
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<T> {
    let lastError: unknown;
    const retryCount = init.method === 'GET' ? this.maxRetries : 0;

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: controller.signal,
        });

        const text = await response.text();
        const parsed = text ? this.parseJsonSafely(text) : undefined;

        if (!response.ok) {
          const detail = this.extractErrorDetail(parsed, text);
          throw new OllamaHttpError(
            response.status,
            `Ollama HTTP ${response.status}${detail ? ` : ${detail}` : ''}`,
          );
        }

        if (!text) {
          return {} as T;
        }

        if (parsed === undefined) {
          throw new Error('Réponse JSON Ollama invalide.');
        }

        return parsed as T;
      } catch (error) {
        lastError = error;

        if (attempt >= retryCount || !this.isRetryable(error)) {
          break;
        }

        await this.delay(250 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }

    if (this.isAbortError(lastError)) {
      throw new GatewayTimeoutException(
        `Ollama n’a pas répondu dans le délai de ${timeoutMs} ms.`,
      );
    }

    if (lastError instanceof OllamaHttpError) {
      throw new ServiceUnavailableException(lastError.message);
    }

    if (
      lastError instanceof ServiceUnavailableException ||
      lastError instanceof GatewayTimeoutException
    ) {
      throw lastError;
    }

    throw new ServiceUnavailableException(
      `Impossible de communiquer avec Ollama sur ${this.baseUrl}. ` +
        this.errorMessage(lastError),
    );
  }

  private isRetryable(error: unknown) {
    if (this.isAbortError(error)) {
      return false;
    }

    if (error instanceof OllamaHttpError) {
      return [429, 500, 502, 503, 504].includes(error.status);
    }

    return true;
  }

  private isAbortError(error: unknown) {
    return (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('aborted'))
    );
  }

  private parseJsonSafely(value: string): unknown {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }

  private extractErrorDetail(parsed: unknown, fallback: string) {
    if (
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
    ) {
      return (parsed as { error: string }).error.slice(0, 1_000);
    }

    return fallback.trim().slice(0, 1_000);
  }

  private nanosecondsToMilliseconds(value?: number) {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    return Math.max(0, Math.round(Number(value) / 1_000_000));
  }

  private normalizeBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, '');
  }

  private normalizeKeepAlive(raw: string | undefined) {
    const value = raw?.trim() || '30m';

    /*
     * Compatibilité avec l'ancienne valeur "-1", refusée comme durée
     * par certaines versions d'Ollama lorsqu'elle est envoyée en chaîne.
     */
    if (value === '-1') {
      return '-1m';
    }

    if (value === '0') {
      return '0';
    }

    const durationPattern =
      /^-?\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h)$/i;

    if (durationPattern.test(value)) {
      return value;
    }

    this.logger.warn(
      `OLLAMA_KEEP_ALIVE="${value}" est invalide. Valeur 30m utilisée.`,
    );

    return '30m';
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

  private readNumber(
    raw: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = Number(raw);

    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, value));
  }

  private readBoolean(raw: string | undefined, fallback: boolean) {
    if (raw === undefined) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return fallback;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      const causeMessage = this.describeCause(cause);

      return causeMessage ? `${error.message} (${causeMessage})` : error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return this.describeCause(error) || 'Erreur inconnue';
  }

  private describeCause(value: unknown) {
    if (!value || typeof value !== 'object') {
      return '';
    }

    const source = value as {
      code?: unknown;
      message?: unknown;
      errno?: unknown;
    };
    const parts = [source.code, source.errno, source.message]
      .filter(
        (item): item is string | number =>
          typeof item === 'string' || typeof item === 'number',
      )
      .map(String)
      .filter(Boolean);

    return parts.join(' · ').slice(0, 1_000);
  }

  private async runExclusive<T>(operation: () => Promise<T>) {
    const previous = this.requestTail;
    let release: (() => void) | undefined;

    this.requestTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    this.activeRequests += 1;

    try {
      return await operation();
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      release?.();
    }
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private async logInitialStatus() {
    const status = await this.getStatus(true);

    if (!status.available) {
      this.logger.warn(
        `Ollama indisponible au démarrage : ${status.error || 'erreur inconnue'}`,
      );
      return;
    }

    if (!status.modelInstalled) {
      this.logger.warn(
        `Ollama est disponible, mais le modèle ${status.configuredModel} est absent.`,
      );
      return;
    }

    this.logger.log(
      `SMART-QA connecté à Ollama ${status.version || ''} avec ${status.configuredModel}.`,
    );
  }
}
