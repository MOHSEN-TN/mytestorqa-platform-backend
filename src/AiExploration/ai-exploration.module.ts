import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationModule } from '../automation/automation.module';
import { AIExplorationController } from './ai-exploration.controller';
import { AIExplorationService } from './ai-exploration.service';
import { AITestGeneratorService } from './generator/ai-test-generator.service';
import { AITestPrioritizerService } from './prioritization/ai-test-prioritizer.service';

@Module({
  imports: [PrismaModule, AutomationModule],
  controllers: [AIExplorationController],
  providers: [
    AIExplorationService,
    AITestGeneratorService,
    AITestPrioritizerService,
  ],
  exports: [AIExplorationService],
})
export class AIExplorationModule {}