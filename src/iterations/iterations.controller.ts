import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExecutionStatus } from '@prisma/client';

import {
  CreateIterationDto,
  UpdateIterationDto,
} from './dto/create-iteration.dto';
import { IterationsService } from './iterations.service';

@ApiTags('Iterations')
@Controller()
export class IterationsController {
  constructor(
    private readonly iterations: IterationsService,
  ) {}

  @Post('campaigns/:campaignId/iterations')
  create(
    @Param('campaignId') campaignId: string,
    @Body() body: CreateIterationDto,
  ) {
    return this.iterations.create(campaignId, body);
  }

  @Get('campaigns/:campaignId/iterations')
  findAll(
    @Param('campaignId') campaignId: string,
  ) {
    return this.iterations.findAll(campaignId);
  }

  @Get('iterations/:iterationId')
  findOne(
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterations.findOne(iterationId);
  }

  @Patch('iterations/:iterationId')
  update(
    @Param('iterationId') iterationId: string,
    @Body() body: UpdateIterationDto,
  ) {
    return this.iterations.update(
      iterationId,
      body,
    );
  }

  @Delete('iterations/:iterationId')
  remove(
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterations.remove(iterationId);
  }

  @Post('iterations/:iterationId/suites')
  addSuites(
    @Param('iterationId') iterationId: string,
    @Body('suiteIds') suiteIds: string[],
  ) {
    return this.iterations.addSuites(
      iterationId,
      suiteIds,
    );
  }

  @Delete('iterations/:iterationId/suites/:suiteId')
  removeSuite(
    @Param('iterationId') iterationId: string,
    @Param('suiteId') suiteId: string,
  ) {
    return this.iterations.removeSuite(
      iterationId,
      suiteId,
    );
  }

  /**
   * Prépare les tests manuels et automatisés,
   * puis démarre les tests Playwright en HEADLESS.
   */
  @Post('iterations/:iterationId/run')
  run(
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterations.startRun(iterationId);
  }

  /**
   * Retourne la progression et les résultats
   * des tests manuels et automatisés.
   */
  @Get('iterations/:iterationId/run')
  getRunItems(
    @Param('iterationId') iterationId: string,
  ) {
    return this.iterations.getRunItems(
      iterationId,
    );
  }

  /**
   * Met à jour uniquement un step manuel.
   */
  @Patch(
    'iterations/items/:itemId/steps/:stepId/status',
  )
  updateStepStatus(
    @Param('itemId') itemId: string,
    @Param('stepId') stepId: string,
    @Body()
    body: {
      status: ExecutionStatus;
      comment?: string;
    },
  ) {
    return this.iterations.updateStepStatus(
      itemId,
      stepId,
      body,
    );
  }
}
