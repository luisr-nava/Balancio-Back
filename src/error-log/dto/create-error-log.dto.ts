import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ErrorSeverity } from '../entities/error-log.entity';

export class CreateErrorLogDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsString()
  @MaxLength(500)
  path: string;

  @IsString()
  @MaxLength(20)
  method: string;

  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @IsOptional()
  @IsUUID('4')
  shopId?: string;

  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;
}
