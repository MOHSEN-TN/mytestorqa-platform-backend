import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum SmartQaChatProvider {
  OLLAMA_LOCAL = 'OLLAMA_LOCAL',
  CLOUD_AI = 'CLOUD_AI',
}

export class CreateSmartQaChatSessionDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  explorationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEnum(SmartQaChatProvider)
  provider?: SmartQaChatProvider;
}

export class SendSmartQaMessageDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  explorationId?: string;

  @IsOptional()
  @IsEnum(SmartQaChatProvider)
  provider?: SmartQaChatProvider;

  @IsString()
  @MinLength(1)
  @MaxLength(8_000)
  message!: string;
}
