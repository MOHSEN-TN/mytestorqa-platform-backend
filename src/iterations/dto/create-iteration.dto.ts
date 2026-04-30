import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIterationDto {
  @ApiProperty({ example: 'Iteration Sprint 1' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Tests de régression pour sprint 1' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateIterationDto extends PartialType(CreateIterationDto) {}