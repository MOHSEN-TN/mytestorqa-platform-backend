// src/bugs/bugs.controller.ts

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
import {
  BugPriority,
  BugSeverity,
  BugStatus,
  RoleType,
} from '@prisma/client';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BugsService } from './bugs.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: RoleType;
  };
};

type CreateBugBody = {
  title: string;
  description?: string;
  steps?: string;
  severity?: BugSeverity;
  priority?: BugPriority;
  projectId?: string;
  testCaseId?: string;
  iterationId?: string;
  executionId?: string;
  assigneeId?: string;
};

type UpdateBugBody = {
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
};

@Controller('bugs')
@UseGuards(JwtAuthGuard)
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Get()
  async listBugs(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: BugStatus | 'ALL' | 'OPEN',
    @Query('projectId') projectId?: string,
    @Query('mine') mine?: string,
  ) {
    return this.bugsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      status: status || 'ALL',
      projectId: projectId || undefined,
      mine: mine === 'true',
      userId: req.user.userId,
    });
  }

  @Get('stats')
  async getStats(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.bugsService.getStats(
      req.user.userId,
    );
  }

  @Get('options')
  async getOptions(
    @Req() req: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
    @Query('suiteId') suiteId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('iterationId') iterationId?: string,
    @Query('testCaseId') testCaseId?: string,
  ) {
    return this.bugsService.getOptions(req.user, {
      projectId: projectId || undefined,
      suiteId: suiteId || undefined,
      campaignId: campaignId || undefined,
      iterationId: iterationId || undefined,
      testCaseId: testCaseId || undefined,
    });
  }

  @Get(':id')
  async getBug(
    @Param('id') id: string,
  ) {
    return this.bugsService.findOne(id);
  }

  @Post()
  async createBug(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateBugBody,
  ) {
    return this.bugsService.create(
      body,
      req.user.userId,
    );
  }

  @Patch(':id')
  async updateBug(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateBugBody,
  ) {
    return this.bugsService.update(
      id,
      body,
      req.user,
    );
  }

  @Delete(':id')
  async deleteBug(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.bugsService.delete(
      id,
      req.user,
    );
  }
}