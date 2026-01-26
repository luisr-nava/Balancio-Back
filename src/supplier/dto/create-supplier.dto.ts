import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
} from 'class-validator';
export class CreateSupplierDto {
  @IsString()
  name: string;

  // 🔹 Categoría opcional
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // 🔹 Shops donde existe el supplier
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  shopIds: string[];

  // 🔹 Datos de contacto
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
