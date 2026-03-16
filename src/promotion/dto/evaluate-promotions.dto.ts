import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemDto {
  @IsUUID()
  shopProductId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class EvaluatePromotionsDto {
  @IsUUID()
  shopId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cartItems: CartItemDto[];
}
