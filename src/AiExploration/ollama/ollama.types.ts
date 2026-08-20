export type OllamaChatRole = 'system' | 'user' | 'assistant';

export type OllamaChatMessage = {
  role: OllamaChatRole;
  content: string;
};

export type OllamaJsonSchema = Record<string, unknown>;

export type OllamaRequestPurpose = 'CHAT' | 'TEST_GENERATION';

export type OllamaChatInput = {
  messages: OllamaChatMessage[];
  model?: string;
  format?: 'json' | OllamaJsonSchema;
  temperature?: number;
  numPredict?: number;
  numCtx?: number;
  seed?: number;
  timeoutMs?: number;
  think?: boolean;
  purpose?: OllamaRequestPurpose;
};

export type OllamaChatMetrics = {
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
};

export type OllamaChatResult = {
  model: string;
  content: string;
  doneReason?: string;
  metrics: OllamaChatMetrics;
};

export type OllamaModelSummary = {
  name: string;
  model?: string;
  size?: number;
  parameterSize?: string;
  quantizationLevel?: string;
};

export type OllamaStatus = {
  available: boolean;
  version?: string;
  configuredModel: string;
  modelInstalled: boolean;
  models: OllamaModelSummary[];
  busy?: boolean;
  checkedAt?: string;
  error?: string;
};
