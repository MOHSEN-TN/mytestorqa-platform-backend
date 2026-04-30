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
import { TestcasesService } from './testcases.service';
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/testcase.dto';

@UseGuards(JwtAuthGuard)
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

  @Get()
  findAll(@Param('suiteId') suiteId: string) {
    return this.testcasesService.findAll(suiteId);
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