import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestsuitesService } from './testsuites.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class TestsuitesController {
  constructor(private suites: TestsuitesService) {}

  @Post('projects/:projectId/suites')
  create(@Param('projectId') projectId: string, @Body('name') name: string) {
    return this.suites.create(projectId, name);
  }

  @Get('projects/:projectId/suites')
  findAll(@Param('projectId') projectId: string) {
    return this.suites.findAll(projectId);
  }

  @Get('suites/:suiteId')
  getOne(@Param('suiteId') suiteId: string) {
    return this.suites.getOne(suiteId);
  }

  @Post('suites/:suiteId/items')
  addItem(
    @Param('suiteId') suiteId: string,
    @Body('testCaseId') testCaseId: string,
  ) {
    return this.suites.addItem(suiteId, testCaseId);
  }
}
