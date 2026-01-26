import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSupplierCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID de la tienda es requerido' })
  shopId: string;
}
