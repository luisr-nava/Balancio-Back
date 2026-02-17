import { IsUUID, IsDecimal, IsNotEmpty } from 'class-validator';

export class SaleReturnItemDto {
  @IsUUID()
  @IsNotEmpty()
  saleItemId: string;

  @IsDecimal({ decimal_digits: '1,6' })
  quantity: string;
}
