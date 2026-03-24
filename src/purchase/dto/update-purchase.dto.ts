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

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

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
