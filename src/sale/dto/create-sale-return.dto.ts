// import {
//   IsArray,
//   IsEnum,
//   IsNotEmpty,
//   IsString,
//   IsUUID,
//   ValidateNested,
//   IsNumber,
//   IsOptional,
// } from 'class-validator';
// import { Type } from 'class-transformer';
// import { RefundType } from '../entities/sale-return.entity';

// export class CreateSaleReturnItemDto {
//   @IsUUID()
//   shopProductId: string;

//   @IsString()
//   quantity: string;

//   @IsNumber()
//   refundAmount: number;
// }

// export class CreateSaleReturnDto {
//   @IsUUID()
//   saleId: string;

//   @IsEnum(RefundType)
//   refundType: RefundType;

//   @IsOptional()
//   @IsString()
//   reason?: string;

//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => CreateSaleReturnItemDto)
//   items: CreateSaleReturnItemDto[];
// }
