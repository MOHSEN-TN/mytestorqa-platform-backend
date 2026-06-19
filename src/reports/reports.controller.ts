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
import { Request } from 'express';
import {
  ReportFormat,
  ReportStatus,
  ReportType,
  RoleType,
} from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: RoleType;
  };
};

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: ReportType | 'ALL',
    @Query('format') format?: ReportFormat | 'ALL',
    @Query('status') status?: ReportStatus | 'ALL',
    @Query('projectId') projectId?: string,
  ) {
    return this.reportsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      type: type || 'ALL',
      format: format || 'ALL',
      status: status || 'ALL',
      projectId,
    });
  }

  @Get('stats')
  stats() {
    return this.reportsService.stats();
  }

  @Get('options')
  options() {
    return this.reportsService.options();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.reportsService.preview(id);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      name: string;
      type: ReportType;
      format: ReportFormat;
      period?: string;
      projectId?: string;
      includeCharts?: boolean;
      includeDetails?: boolean;
      includeLogs?: boolean;
    },
  ) {
    return this.reportsService.create(body, req.user);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      type?: ReportType;
      format?: ReportFormat;
      status?: ReportStatus;
      period?: string;
      projectId?: string;
      includeCharts?: boolean;
      includeDetails?: boolean;
      includeLogs?: boolean;
    },
  ) {
    return this.reportsService.update(id, body, req.user);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reportsService.remove(id, req.user);
  }
}