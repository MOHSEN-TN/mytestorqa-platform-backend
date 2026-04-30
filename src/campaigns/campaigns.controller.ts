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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/create-campaign.dto';

@ApiTags('Campaigns')
@UseGuards(JwtAuthGuard)
@Controller()
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Post('projects/:projectId/campaigns')
  create(
    @Param('projectId') projectId: string,
    @Body() body: Omit<CreateCampaignDto, 'projectId'>,
  ) {
    return this.campaigns.create(projectId, body);
  }

  @Get('projects/:projectId/campaigns')
  findAll(@Param('projectId') projectId: string) {
    return this.campaigns.findAll(projectId);
  }

  @Get('campaigns/:campaignId')
  findOne(@Param('campaignId') campaignId: string) {
    return this.campaigns.findOne(campaignId);
  }

  @Patch('campaigns/:campaignId')
  update(
    @Param('campaignId') campaignId: string,
    @Body() body: UpdateCampaignDto,
  ) {
    return this.campaigns.update(campaignId, body);
  }

  @Delete('campaigns/:campaignId')
  remove(@Param('campaignId') campaignId: string) {
    return this.campaigns.remove(campaignId);
  }
}