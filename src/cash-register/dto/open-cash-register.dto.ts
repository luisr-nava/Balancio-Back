import {
  IsNumber,
  IsPositive,
  IsUUID,
  IsOptional,
  IsString,
} from 'class-validator';

export class OpenCashRegisterDto {
  @IsUUID()
  shopId: string;

  @IsNumber()
  @IsPositive()
  openingAmount: number;

  @IsOptional()
  @IsUUID()
  openedByUserId?: string;

  @IsOptional()
  @IsString()
  openedByName?: string;
}
