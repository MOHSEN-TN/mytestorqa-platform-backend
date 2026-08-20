export type GeminiChatRole = 'system' | 'user' | 'assistant';

export type GeminiChatMessage = {
  role: GeminiChatRole;
  content: string;
};

export type GeminiJsonSchema = Record<string, unknown>;

export type GeminiChatInput = {
  messages: GeminiChatMessage[];
  model?: string;
  responseSchema?: GeminiJsonSchema;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

export type GeminiChatMetrics = {
  totalDurationMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type GeminiChatResult = {
  model: string;
  content: string;
  doneReason?: string;
  metrics: GeminiChatMetrics;
};

export type GeminiStatus = {
  available: boolean;
  configured: boolean;
  configuredModel: string;
  apiVersion?: string;
  displayName?: string;
  error?: string;
};
