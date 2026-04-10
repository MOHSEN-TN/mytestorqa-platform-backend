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
@Controller('projects/:projectId/testcases')
export class TestcasesController {
  constructor(private readonly testcasesService: TestcasesService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() data: CreateTestCaseDto,
  ) {
    return this.testcasesService.create(projectId, data);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.testcasesService.findAll(projectId);
  }

  @Get(':testCaseId')
  findOne(@Param('testCaseId') testCaseId: string) {
    return this.testcasesService.findOne(testCaseId);
  }

  @Patch(':testCaseId')
  update(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
    @Body() data: UpdateTestCaseDto,
  ) {
    return this.testcasesService.update(projectId, testCaseId, data);
  }

  @Delete(':testCaseId')
  remove(
    @Param('projectId') projectId: string,
    @Param('testCaseId') testCaseId: string,
  ) {
    return this.testcasesService.remove(projectId, testCaseId);
  }
}