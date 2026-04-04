import { IsArray, ValidateNested, IsBoolean, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../entities/notification.entity';

class PreferenceItemDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  threshold?: number | null;
}

export class BatchUpdatePreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceItemDto)
  preferences: PreferenceItemDto[];
}
