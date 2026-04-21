import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceType, PaymentStatus } from '../entities/sale.entity';

export class CreateSaleItemDto {
  @IsString()
  shopProductId: string;

  @IsString()
  quantity: string;

  @IsNumber()
  @IsNotEmpty()
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  priceWasModified?: boolean;

  @IsOptional()
  isPromotion?: boolean;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class CreateSaleDto {
  @IsUUID()
  shopId: string;

  @IsUUID()
  paymentMethodId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsBoolean()
  isOnCredit?: boolean;

  // 🔹 items
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  // 🔹 montos (calculados pero explícitos)
  // @IsNumber()
  // subtotal: number;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  // @IsNumber()
  // totalAmount: number;

  // 🔹 estado de pago
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  // 🔹 factura
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  // 🔹 notas
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;
}
