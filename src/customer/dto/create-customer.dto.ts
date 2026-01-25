import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
  Length,
  IsNotEmpty,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  fullName: string;

  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  dni?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @Min(0, { message: 'El límite de crédito debe ser mayor o igual a 0' })
  @IsOptional()
  creditLimit?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID de la tienda es requerido' })
  shopId: string;
}
