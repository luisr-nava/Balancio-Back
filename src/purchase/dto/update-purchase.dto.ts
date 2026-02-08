import {
  IsArray,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdatePurchaseItemDto {
  @IsUUID()
  shopProductId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseItemDto)
  items?: UpdatePurchaseItemDto[];
}
