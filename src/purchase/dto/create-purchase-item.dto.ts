import { IsUUID, IsInt, Min, IsNumber } from 'class-validator';

export class CreatePurchaseItemDto {
  @IsUUID()
  shopProductId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;
}
