import { CURRENCY_CODES } from '@/common/constants/currencies';
import {
  IsString,
  Length,
  IsOptional,
  IsISO31661Alpha2,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class CreateShopDto {
  @IsString({
    message: 'Name must be a string',
  })
  @Length(4, 20, {
    message: 'Name must be between 4 and 20 characters',
  })
  name: string;

  @IsOptional()
  @IsString({
    message: 'Address must be a string',
  })
  @Length(4, 20, {
    message: 'Address must be between 4 and 20 characters',
  })
  address: string;

  @IsOptional()
  @IsString({
    message: 'Phone must be a string',
  })
  phone: string;

  @IsISO31661Alpha2({
    message: 'countryCode must be a valid ISO 3166-1 alpha-2 code',
  })
  countryCode: string;

  @IsString()
  @IsIn(CURRENCY_CODES, {
    message: 'currencyCode must be a valid ISO 4217 code',
  })
  currencyCode: string;

  @IsOptional()
  @IsBoolean({
    message: 'isActive must be a boolean',
  })
  isActive: boolean;
}
