import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({
    example: '2f4b9d2e-7b61-4a3e-9d6a-1b2c3d4e5f60',
    description: 'ID du projet auquel appartient la campagne',
  })
  @IsString()
  projectId: string;

  @ApiProperty({
    example: 'Campagne 2026',
    description: 'Nom de la campagne de test',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Campagne annuelle de tests de régression',
    description: 'Description optionnelle de la campagne',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}