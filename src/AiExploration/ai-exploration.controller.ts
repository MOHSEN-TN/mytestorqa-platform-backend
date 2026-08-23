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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AIExplorationService,
  CreateAIExplorationDto,
  UpdateAIExplorationDto,
} from './ai-exploration.service';
import {
  AISuggestionConverterService,
  ConvertAISuggestionDto,
} from './converter/ai-suggestion-converter.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

@Controller('ai-exploration')
@UseGuards(JwtAuthGuard)
export class AIExplorationController {
  constructor(
    private readonly aiExplorationService: AIExplorationService,
    private readonly aiSuggestionConverterService: AISuggestionConverterService,
  ) {}

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.aiExplorationService.findPaginatedByUser(req.user.userId, {
      projectId,
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 5,
      search,
    });
  }

  @Get('options')
  findOptions(@Req() req: AuthenticatedRequest) {
    return this.aiExplorationService.findOptionsByUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiExplorationService.findOne(id);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAIExplorationDto) {
    return this.aiExplorationService.create({
      ...dto,
      createdById: req.user.userId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAIExplorationDto) {
    return this.aiExplorationService.update(id, dto);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.aiExplorationService.generate(id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.aiExplorationService.validate(id);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.aiExplorationService.archive(id);
  }

  @Post('suggestions/:id/convert')
  convertSuggestion(
    @Param('id') id: string,
    @Body() dto: ConvertAISuggestionDto,
  ) {
    return this.aiSuggestionConverterService.convertSuggestionToTestCase(
      id,
      dto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiExplorationService.remove(id);
  }
}