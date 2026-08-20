import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectTransferService } from './project-transfer.service';
import { ProjectsService } from './projects.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

type UploadedXlsxFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type CreateProjectDto = {
  name: string;
  description?: string | null;
  baseUrl?: string | null;
};

type UpdateProjectDto = {
  name?: string;
  description?: string | null;
  baseUrl?: string | null;
};

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectTransferService: ProjectTransferService,
  ) {}

  /*
   * --------------------------------------------------------------------------
   * TRANSFERT XLSX
   * Les routes statiques restent avant les routes dynamiques :id.
   * --------------------------------------------------------------------------
   */

  @Get('transfer/export')
  async exportProjects(
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const result = await this.projectTransferService.exportProjects(
      req.user.userId,
    );

    response.setHeader(
      'Content-Type',
      result.contentType,
    );

    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    response.setHeader(
      'Content-Length',
      String(result.buffer.length),
    );

    return response.send(result.buffer);
  }

  @Post('transfer/import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  previewImport(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedXlsxFile,
  ) {
    const validatedFile = this.validateImportFile(file);

    return this.projectTransferService.previewImport(
      req.user.userId,
      validatedFile.buffer,
    );
  }

  @Post('transfer/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined,
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  importProjects(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: UploadedXlsxFile,
  ) {
    const validatedFile = this.validateImportFile(file);

    return this.projectTransferService.importProjects(
      req.user.userId,
      validatedFile.buffer,
    );
  }

  /*
   * --------------------------------------------------------------------------
   * CRUD PROJETS
   * --------------------------------------------------------------------------
   */

  @Get()
  listProjects(
    @Req() req: AuthenticatedRequest,
    @Query('name') name?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.listProjects(
      req.user.userId,
      name,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
      },
    );
  }

  @Post()
  createProject(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateProjectDto,
  ) {
    return this.projectsService.createProject(
      req.user.userId,
      body.name,
      body.description,
      body.baseUrl,
    );
  }

  @Patch(':id')
  updateProject(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(
      id,
      body,
    );
  }

  @Delete(':id')
  deleteProject(
    @Param('id') id: string,
  ) {
    return this.projectsService.deleteProject(id);
  }

  @Post(':projectId/duplicate')
  duplicateProject(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.duplicate(
      projectId,
      req.user.userId,
    );
  }

  private validateImportFile(
    file?: UploadedXlsxFile,
  ): UploadedXlsxFile {
    if (!file) {
      throw new BadRequestException(
        'Aucun fichier XLSX n’a été fourni.',
      );
    }

    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException(
        'Le fichier doit être au format .xlsx.',
      );
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Le fichier XLSX fourni est vide.',
      );
    }

    return file;
  }
}
