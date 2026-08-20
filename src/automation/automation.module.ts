import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { PlaywrightCodegenService } from './playwright-codegen.service';
import { PlaywrightExplorerService } from './playwright/playwright-explorer.service';
import { PlaywrightCodeGeneratorService } from './playwright/playwright-code-generator.service';
import { PlaywrightRunnerService } from './playwright/playwright-runner.service';

@Module({
  imports: [PrismaModule],

  controllers: [AutomationController],

  providers: [
    AutomationService,
    PlaywrightExplorerService,
    PlaywrightCodeGeneratorService,
    PlaywrightRunnerService,
    PlaywrightCodegenService,
  ],

  exports: [
    AutomationService,
    PlaywrightExplorerService,
    PlaywrightCodeGeneratorService,
    PlaywrightRunnerService,
    PlaywrightCodegenService,
  ],
})
export class AutomationModule {}