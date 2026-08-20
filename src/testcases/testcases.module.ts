import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { TestcasesController } from './testcases.controller';
import { TestcasesService } from './testcases.service';

import { PlaywrightCodeNormalizerService } from './automation/playwright-code-normalizer.service';
import { PlaywrightProcessService } from './automation/playwright-process.service';
import { PlaywrightReportParserService } from './automation/playwright-report-parser.service';
import { PlaywrightRunnerService } from './automation/playwright-runner.service';
import { PlaywrightSpecBuilderService } from './automation/playwright-spec-builder.service';

@Module({
  imports: [PrismaModule],

  controllers: [TestcasesController],

  providers: [
    TestcasesService,
    PlaywrightRunnerService,
    PlaywrightSpecBuilderService,
    PlaywrightProcessService,
    PlaywrightReportParserService,
    PlaywrightCodeNormalizerService,
  ],

  /**
   * Permet à IterationsModule d'injecter le runner Playwright complet.
   *
   * Les dépendances internes du runner restent gérées dans ce module.
   */
  exports: [PlaywrightRunnerService],
})
export class TestcasesModule {}