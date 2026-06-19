// src/bugs/bugs.controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BugPriority, BugSeverity, BugStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BugsService } from './bugs.service';

@Controller('bugs')
@UseGuards(JwtAuthGuard)
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Get()
  async listBugs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: BugStatus | 'ALL' | 'OPEN',
    @Query('mine') mine?: string,
  ) {
    return this.bugsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      status: status || 'ALL',
      mine: mine === 'true',
      userId: req.user.userId,
    });
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.bugsService.getStats(req.user.userId);
  }

  @Get('options')
  async getOptions() {
    return this.bugsService.getOptions();
  }

  @Get(':id')
  async getBug(@Param('id') id: string) {
    return this.bugsService.findOne(id);
  }

  @Post()
  async createBug(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description?: string;
      steps?: string;
      severity?: BugSeverity;
      priority?: BugPriority;
      projectId?: string;
      testCaseId?: string;
      executionId?: string;
      assigneeId?: string;
    },
  ) {
    return this.bugsService.create(body, req.user.userId);
  }

  @Patch(':id')
  async updateBug(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      steps?: string;
      status?: BugStatus;
      severity?: BugSeverity;
      priority?: BugPriority;
      projectId?: string;
      testCaseId?: string;
      executionId?: string;
      assigneeId?: string;
    },
  ) {
    return this.bugsService.update(id, body, req.user);
  }

  @Delete(':id')
  async deleteBug(@Req() req: any, @Param('id') id: string) {
    return this.bugsService.delete(id, req.user);
  }
}