import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AIExplorationController } from './ai-exploration.controller';
import { AIExplorationService } from './ai-exploration.service';
import { SmartQaChatController } from './chat/smart-qa-chat.controller';
import { SmartQaContextService } from './chat/smart-qa-context.service';
import { SmartQaChatService } from './chat/smart-qa-chat.service';
import { AISuggestionConverterService } from './converter/ai-suggestion-converter.service';
import { GeminiService } from './gemini/gemini.service';
import { AITestGeneratorService } from './generator/ai-test-generator.service';
import { GeminiTestGeneratorService } from './generator/gemini-test-generator.service';
import { OllamaTestGeneratorService } from './generator/ollama-test-generator.service';
import { SmartLocatorService } from './locator/smart-locator.service';
import { OllamaService } from './ollama/ollama.service';
import { AITestPrioritizerService } from './prioritization/ai-test-prioritizer.service';

@Module({
  imports: [PrismaModule, AutomationModule],
  controllers: [AIExplorationController, SmartQaChatController],
  providers: [
    AIExplorationService,
    AITestGeneratorService,
    OllamaTestGeneratorService,
    GeminiTestGeneratorService,
    AITestPrioritizerService,
    AISuggestionConverterService,
    SmartLocatorService,
    OllamaService,
    GeminiService,
    SmartQaContextService,
    SmartQaChatService,
  ],
  exports: [
    AIExplorationService,
    AISuggestionConverterService,
    SmartLocatorService,
    OllamaService,
    GeminiService,
    SmartQaChatService,
  ],
})
export class AIExplorationModule {}
