import { AISuggestionPriority } from '@prisma/client';

export type GeneratedAISuggestion = {
  title: string;
  description: string;
  expectedResult: string;
  priority: AISuggestionPriority;
};