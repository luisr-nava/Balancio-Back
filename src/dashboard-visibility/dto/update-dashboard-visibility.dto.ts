import { IsObject, ValidateNested, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class RoleVisibilityDto {
  @IsBoolean()
  metrics: boolean;

  @IsBoolean()
  charts: boolean;

  @IsBoolean()
  cash: boolean;

  @IsBoolean()
  analytics: boolean;
}

export class UpdateDashboardVisibilityDto {
  @IsObject()
  @ValidateNested()
  @Type(() => RoleVisibilityDto)
  OWNER: RoleVisibilityDto;

  @IsObject()
  @ValidateNested()
  @Type(() => RoleVisibilityDto)
  MANAGER: RoleVisibilityDto;

  @IsObject()
  @ValidateNested()
  @Type(() => RoleVisibilityDto)
  EMPLOYEE: RoleVisibilityDto;
}
