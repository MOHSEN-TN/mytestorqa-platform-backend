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
import { ProjectsService } from './projects.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

type CreateProjectDto = {
  name: string;
};

type UpdateProjectDto = {
  name: string;
};

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  listProjects(
    @Req() req: AuthenticatedRequest,
    @Query('name') name?: string
  ) {
    return this.projectsService.listProjects(req.user.userId, name);
  }

  @Post()
  createProject(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateProjectDto,
  ) {
    return this.projectsService.createProject(req.user.userId, body.name);
  }

  @Patch(':id')
  updateProject(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return this.projectsService.updateProject(id, body.name);
  }

  @Delete(':id')
  deleteProject(@Param('id') id: string) {
    return this.projectsService.deleteProject(id);
  }

  @Post(':projectId/duplicate')
  duplicateProject(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.duplicate(projectId, req.user.userId);
  }
}