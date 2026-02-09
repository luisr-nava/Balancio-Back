import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceType } from '../entities/sale.entity';
import { CreateSaleItemDto } from './create-sale.dto';

export class UpdateSaleDto {
  // 🔁 items (opcional)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items?: CreateSaleItemDto[];

  // 🔁 montos
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  // 🔁 cliente
  @IsOptional()
  @IsUUID()
  customerId?: string | null;

  // 🔁 factura
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  // 🔁 notas
  @IsOptional()
  @IsString()
  notes?: string;
}
