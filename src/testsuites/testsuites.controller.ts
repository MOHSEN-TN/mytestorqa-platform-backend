import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestsuitesService } from './testsuites.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TestsuitesController {
  constructor(private suites: TestsuitesService) {}

  @Post('projects/:projectId/suites')
  create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.suites.create(projectId, body);
  }

  @Get('projects/:projectId/suites')
  findAll(@Param('projectId') projectId: string) {
    return this.suites.findAll(projectId);
  }

  @Get('suites/:suiteId')
  getOne(@Param('suiteId') suiteId: string) {
    return this.suites.getOne(suiteId);
  }

  @Patch('suites/:suiteId')
  update(
    @Param('suiteId') suiteId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.suites.update(suiteId, body);
  }

  @Delete('suites/:suiteId')
  remove(@Param('suiteId') suiteId: string) {
    return this.suites.remove(suiteId);
  }

  @Post('suites/:suiteId/duplicate')
  duplicate(@Param('suiteId') suiteId: string) {
    return this.suites.duplicate(suiteId);
  }
}