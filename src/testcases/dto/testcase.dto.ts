import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TestStepDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  expected?: string;
}

export class CreateTestCaseDto {
  @ApiProperty({ example: 'authentification' })
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
   @ApiProperty({ example: 'p tester  auth' })
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestStepDto)
  steps?: TestStepDto[];

  @IsOptional()
  @IsString()
  expected?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'READY', 'DEPRECATED'])
  status?: 'DRAFT' | 'READY' | 'DEPRECATED';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class UpdateTestCaseDto extends PartialType(CreateTestCaseDto) {}