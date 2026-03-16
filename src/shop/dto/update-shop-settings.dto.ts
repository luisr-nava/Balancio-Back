import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateShopSettingsDto {
  @IsOptional()
  @IsString()
  @Length(4, 50)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
