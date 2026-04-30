import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  create(
    projectId: string,
    data: { name: string; description?: string },
  ) {
    return this.prisma.testCampaign.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
      },
    });
  }

  findAll(projectId: string) {
    return this.prisma.testCampaign.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        iterations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findOne(campaignId: string) {
    const campaign = await this.prisma.testCampaign.findUnique({
      where: { id: campaignId },
      include: {
        iterations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(campaignId: string, data: UpdateCampaignDto) {
    const existing = await this.prisma.testCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.testCampaign.update({
      where: { id: campaignId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async remove(campaignId: string) {
    const existing = await this.prisma.testCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.testCampaign.delete({
      where: { id: campaignId },
    });
  }
}