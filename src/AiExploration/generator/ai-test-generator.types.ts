import { AISuggestionPriority } from '@prisma/client';

export type GeneratedAIStep = {
  action: string;
  expected?: string;
};

export type GeneratedAISuggestion = {
  title: string;
  description: string;
  expectedResult: string;
  priority: AISuggestionPriority;
  steps?: GeneratedAIStep[];
  gherkin?: string;
  sourcePageUrl?: string;
  aiConfidence?: number;
};

export type AIGenerationMetrics = {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalDurationMs?: number;
  requestAttempts?: number;
  snapshotCharacters?: number;
  outputMode?: 'JSON_SCHEMA' | 'JSON' | 'PROMPT_JSON';
};

export type AIGenerationResult = {
  suggestions: GeneratedAISuggestion[];
  metrics?: AIGenerationMetrics;
};
