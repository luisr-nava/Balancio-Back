import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class PrintPriceLabelsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  shopProductIds: string[];

  @IsOptional()
  copies?: number;
}
