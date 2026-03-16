import { Type } from 'class-transformer';
import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { CartItemDto } from './evaluate-promotions.dto';

export class ApplyPromotionDto {
  @IsUUID()
  promotionId: string;

  @IsUUID()
  shopId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cartItems: CartItemDto[];
}
