import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RunsService } from './runs.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class RunsController {
  constructor(private runs: RunsService) {}

  @Post('suites/:suiteId/runs')
  createRun(@Param('suiteId') suiteId: string, @Body('name') name: string) {
    return this.runs.createRunFromSuite(
      suiteId,
      name ?? `Run ${new Date().toISOString()}`,
    );
  }

  @Get('suites/:suiteId/runs')
  listRuns(@Param('suiteId') suiteId: string) {
    return this.runs.listRunsBySuite(suiteId);
  }

  @Get('runs/:runId')
  getRun(@Param('runId') runId: string) {
    return this.runs.getRun(runId);
  }

  @Patch('run-items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body()
    body: {
      status?: 'TODO' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
      comment?: string;
      duration?: number;
    },
  ) {
    return this.runs.updateRunItem(itemId, body);
  }

  //stats run
  @Get('runs/:runId/stats')
  getRunStats(@Param('runId') runId: string) {
    return this.runs.getRunStats(runId);
  }
}
