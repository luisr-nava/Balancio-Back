import { IsUUID, IsOptional, IsNumber, IsString } from 'class-validator';

export class BulkUpdateProductDto {
  @IsUUID('4', { each: true })
  shopProductIds: string[];

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
