import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  // UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { PlaywrightCodegenService } from './playwright-codegen.service';

import { GenerateFromTestCaseDto } from './dto/generate-from-testcase.dto';
import { RunPlaywrightDto } from './dto/run-playwright.dto';
import { ExplorerInput } from './playwright/playwright.types';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

type StartCodegenDto = {
  url: string;
  testCaseId?: string;
};

type ImportCodegenDto = {
  testCaseId?: string;
};

@Controller('automation')
// @UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly playwrightCodegenService: PlaywrightCodegenService,
  ) {}

  @Post('explore')
  explore(
    @Req() _req: AuthenticatedRequest,
    @Body() body: ExplorerInput,
  ) {
    return this.automationService.explore(body);
  }

  @Post('test-cases/:id/generate-playwright')
  generateFromTestCase(
    @Param('id') id: string,
    @Body() body: GenerateFromTestCaseDto,
  ) {
    return this.automationService.generatePlaywrightFromTestCase(
      id,
      body.baseUrl,
    );
  }

  @Post('run-smoke')
  runSmokeTest(@Body() body: RunPlaywrightDto) {
    console.log('RUN SMOKE BODY =', body);

    return this.automationService.runSmokeTest(body);
  }

  /**
   * Démarre une session Playwright Codegen.
   *
   * POST /automation/codegen/start
   * Body:
   * {
   *   "url": "https://example.com",
   *   "testCaseId": "optional-test-case-id"
   * }
   */
  @Post('codegen/start')
  startCodegen(@Body() body: StartCodegenDto) {
    return this.playwrightCodegenService.start(
      body.url,
      body.testCaseId,
    );
  }

  /**
   * Retourne l'état courant de la session et le code généré
   * lorsque la session est terminée.
   *
   * GET /automation/codegen/:sessionId/status
   */
  @Get('codegen/:sessionId/status')
  getCodegenStatus(@Param('sessionId') sessionId: string) {
    return this.playwrightCodegenService.getStatus(sessionId);
  }

  /**
   * Importe le code généré directement dans le cas de test.
   *
   * POST /automation/codegen/:sessionId/import
   * Body:
   * {
   *   "testCaseId": "optional-if-already-linked-at-start"
   * }
   */
  @Post('codegen/:sessionId/import')
  importCodegen(
    @Param('sessionId') sessionId: string,
    @Body() body: ImportCodegenDto,
  ) {
    return this.playwrightCodegenService.importIntoTestCase(
      sessionId,
      body.testCaseId,
    );
  }

  /**
   * Annule une session encore en cours et arrête Playwright Codegen.
   *
   * POST /automation/codegen/:sessionId/cancel
   */
  @Post('codegen/:sessionId/cancel')
  cancelCodegen(@Param('sessionId') sessionId: string) {
    return this.playwrightCodegenService.cancel(sessionId);
  }
}
