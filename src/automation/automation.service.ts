import { Injectable } from '@nestjs/common';
import { PlaywrightExplorerService } from './playwright/playwright-explorer.service';
import { PlaywrightCodeGeneratorService } from './playwright/playwright-code-generator.service';
import { PlaywrightRunnerService } from './playwright/playwright-runner.service';
import { ExplorerInput } from './playwright/playwright.types';
import { RunPlaywrightDto } from './dto/run-playwright.dto';

@Injectable()
export class AutomationService {
  constructor(
    private readonly playwrightExplorerService: PlaywrightExplorerService,
    private readonly playwrightCodeGeneratorService: PlaywrightCodeGeneratorService,
    private readonly playwrightRunnerService: PlaywrightRunnerService,
  ) {}

  explore(input: ExplorerInput) {
    return this.playwrightExplorerService.explore(input);
  }

  generatePlaywrightFromTestCase(testCaseId: string, baseUrl?: string) {
    return this.playwrightCodeGeneratorService.generateFromTestCase(
      testCaseId,
      baseUrl,
    );
  }

  runSmokeTest(dto: RunPlaywrightDto) {
    return this.playwrightRunnerService.runSmokeTest(dto);
  }
}