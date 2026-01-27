import { Transform } from 'class-transformer';
import { IsString, IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  name: string;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  shopIds: string[];
}
