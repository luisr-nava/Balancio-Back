import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  threshold?: number | null;
}
