import { PartialType } from '@nestjs/mapped-types';
import { CreateProductCategoryDto } from './create-product-category.dto';
import { ArrayNotEmpty, IsArray, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductCategoryDto extends PartialType(
  CreateProductCategoryDto,
) {
  @IsString()
  name: string;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  shopIds: string[];
}
