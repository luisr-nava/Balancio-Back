import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleReturnItemDto } from './sale-return-item.dto';
import { RefundMethod } from '../enums/refund-method.enum';

export enum ReturnCondition {
  SELLABLE = 'SELLABLE',
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
}

export class CreateSaleReturnDto {
  @IsUUID()
  saleId: string;

  @IsUUID()
  shopId: string;

  @IsEnum(RefundMethod)
  refundMethod: RefundMethod;

  @IsOptional()
  @IsString()
  reason?: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnItemDto)
  items: SaleReturnItemDto[];

  @IsEnum(ReturnCondition)
  returnCondition: ReturnCondition;
}
