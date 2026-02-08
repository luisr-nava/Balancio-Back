import {
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsDateString,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class CreatePurchaseDto {
  @IsUUID()
  shopId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsUUID()
  paymentMethodId: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  @IsNotEmpty({ each: true })
  items: CreatePurchaseItemDto[];
}
