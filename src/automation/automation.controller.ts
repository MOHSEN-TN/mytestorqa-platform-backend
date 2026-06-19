



import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  //UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
//import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationService } from './automation.service';
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



@Controller('automation')
//@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('explore')
  explore(@Req() req: AuthenticatedRequest, @Body() body: ExplorerInput) {
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
}