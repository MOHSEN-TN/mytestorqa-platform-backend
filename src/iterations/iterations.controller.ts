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
import { ApiTags } from '@nestjs/swagger';
import { ExecutionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IterationsService } from './iterations.service';
import {
  CreateIterationDto,
  UpdateIterationDto,
} from './dto/create-iteration.dto';

@ApiTags('Iterations')
@UseGuards(JwtAuthGuard)
@Controller()
export class IterationsController {
  constructor(private iterations: IterationsService) {}

  @Post('campaigns/:campaignId/iterations')
  create(
    @Param('campaignId') campaignId: string,
    @Body() body: CreateIterationDto,
  ) {
    return this.iterations.create(campaignId, body);
  }

  @Get('campaigns/:campaignId/iterations')
  findAll(@Param('campaignId') campaignId: string) {
    return this.iterations.findAll(campaignId);
  }

  @Get('iterations/:iterationId')
  findOne(@Param('iterationId') iterationId: string) {
    return this.iterations.findOne(iterationId);
  }

  @Patch('iterations/:iterationId')
  update(
    @Param('iterationId') iterationId: string,
    @Body() body: UpdateIterationDto,
  ) {
    return this.iterations.update(iterationId, body);
  }

  @Delete('iterations/:iterationId')
  remove(@Param('iterationId') iterationId: string) {
    return this.iterations.remove(iterationId);
  }

  @Post('iterations/:iterationId/suites')
  addSuites(
    @Param('iterationId') iterationId: string,
    @Body('suiteIds') suiteIds: string[],
  ) {
    return this.iterations.addSuites(iterationId, suiteIds);
  }

  @Delete('iterations/:iterationId/suites/:suiteId')
  removeSuite(
    @Param('iterationId') iterationId: string,
    @Param('suiteId') suiteId: string,
  ) {
    return this.iterations.removeSuite(iterationId, suiteId);
  }

  /**
   * Génère les IterationItem + IterationItemStep.
   * Cette route est appelée quand on clique sur "Lancer l'exécution".
   */
  @Post('iterations/:iterationId/run')
  run(@Param('iterationId') iterationId: string) {
    return this.iterations.generateItems(iterationId);
  }

  /**
   * Récupère les cas de test de l'itération avec leurs steps
   * et les statuts d'exécution de chaque step.
   */
  @Get('iterations/:iterationId/run')
  getRunItems(@Param('iterationId') iterationId: string) {
    return this.iterations.getRunItems(iterationId);
  }

  /**
   * Met à jour le statut manuel d'un step pendant l'exécution.
   * Après cette mise à jour, le backend recalcule automatiquement
   * le statut global du cas de test exécuté.
   */
  @Patch('iterations/items/:itemId/steps/:stepId/status')
  updateStepStatus(
    @Param('itemId') itemId: string,
    @Param('stepId') stepId: string,
    @Body()
    body: {
      status: ExecutionStatus;
      comment?: string;
    },
  ) {
    return this.iterations.updateStepStatus(itemId, stepId, body);
  }
}