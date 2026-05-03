import { IsOptional, IsString, IsArray, ValidateNested, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptPaperSize } from '../receipt/types/receipt.types';

class CustomFieldDto {
  @IsString()
  label: string;

  @IsString()
  value: string;
}

export class UpdateTicketSettingsDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsBoolean()
  showWebsite?: boolean;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  footerMessage?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDto)
  customFields?: CustomFieldDto[];

  @IsOptional()
  @IsEnum(ReceiptPaperSize)
  paperSize?: ReceiptPaperSize;

  @IsOptional()
  @IsBoolean()
  ticketsEnabled?: boolean;
}
