import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';

class CreateProductShopDto {
  @IsUUID()
  shopId: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNumber()
  costPrice: number;

  @IsNumber()
  salePrice: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  // overrides por tienda
  @IsOptional()
  @IsUUID()
  measurementUnitId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  taxCategory?: string;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  allowPriceOverride?: boolean;

  // defaults globales del producto
  @IsOptional()
  @IsUUID()
  measurementUnitId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateProductShopDto)
  shops: CreateProductShopDto[];
}
