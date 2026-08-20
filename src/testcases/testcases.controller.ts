/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TestcasesService } from './testcases.service';
import {
  CreateTestCaseDto,
  GetAllTestCasesBySuitesDTO,
  MoveTestCaseDto,
  UpdateTestCaseDto,
} from './dto/testcase.dto';

type RunAutomationDto = {
  headed?: boolean;
  slowMo?: number;
};

// Réactiver le guard quand les tests locaux sont terminés.
// @UseGuards(JwtAuthGuard)
@Controller('suites/:suiteId/testcases')
export class TestcasesController {
  constructor(private readonly testcasesService: TestcasesService) {}

  @Post()
  create(
    @Param('suiteId') suiteId: string,
    @Body() data: CreateTestCaseDto,
  ) {
    return this.testcasesService.create(suiteId, data);
  }

  @Post('by-pagination')
  findAll(
    @Param('suiteId') suiteId: string,
    @Body() data: GetAllTestCasesBySuitesDTO,
  ): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
    return this.testcasesService.findAll(suiteId, data);
  }

  @Get(':testCaseId')
  findOne(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.testcasesService.findOne(suiteId, testCaseId);
  }

  @Patch(':testCaseId')
  update(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() data: UpdateTestCaseDto,
  ) {
    return this.testcasesService.update(suiteId, testCaseId, data);
  }

  @Patch(':testCaseId/move')
  move(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() data: MoveTestCaseDto,
  ) {
    return this.testcasesService.move(
      suiteId,
      testCaseId,
      data.targetSuiteId,
    );
  }

  @Post(':testCaseId/run-automation')
  runAutomation(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() data?: RunAutomationDto,
  ) {
    return this.testcasesService.runAutomation(suiteId, testCaseId, {
      headed: data?.headed ?? false,
      slowMo: data?.slowMo,
    });
  }

  @Delete(':testCaseId')
  remove(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.testcasesService.remove(suiteId, testCaseId);
  }

  @Post(':testCaseId/duplicate')
  duplicate(
    @Param('suiteId') suiteId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.testcasesService.duplicate(suiteId, testCaseId);
  }
}
