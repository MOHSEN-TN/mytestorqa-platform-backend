import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TestCaseStatusDto {
  DRAFT = 'DRAFT',
  READY = 'READY',
  DEPRECATED = 'DEPRECATED',
}

export enum TestPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Status {
  ALL= 'ALL',
  DRAFT = 'DRAFT',
  READY = 'READY',
  DEPRECATED = 'DEPRECATED',
}

export class TestStepDto {
  @ApiProperty({ example: 'Open login page' })
  @IsString()
  action: string;

  @ApiPropertyOptional({ example: 'Login page is displayed' })
  @IsOptional()
  @IsString()
  expected?: string;
}

export class CreateTestCaseDto {
  @ApiProperty({ example: 'Authentification' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Tester le flow d’authentification' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'L’utilisateur est authentifié avec succès' })
  @IsOptional()
  @IsString()
  expected?: string;

  @ApiPropertyOptional({ enum: TestCaseStatusDto, example: TestCaseStatusDto.DRAFT })
  @IsOptional()
  @IsEnum(TestCaseStatusDto)
  status?: TestCaseStatusDto;

  @ApiPropertyOptional({ enum: TestPriorityDto, example: TestPriorityDto.MEDIUM })
  @IsOptional()
  @IsEnum(TestPriorityDto)
  priority?: TestPriorityDto;

  @ApiPropertyOptional({
    type: [TestStepDto],
    example: [
      {
        action: 'Open login page',
        expected: 'Login page is displayed',
      },
      {
        action: 'Enter valid credentials',
        expected: 'User is redirected to dashboard',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestStepDto)
  steps?: TestStepDto[];
}

export class UpdateTestCaseDto extends PartialType(CreateTestCaseDto) {}


export class GetAllTestCasesBySuitesDTO {
  @ApiPropertyOptional({ example: 'ALL' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'LOW' })
  @IsOptional()
  @IsString()
  priority?: string;
}