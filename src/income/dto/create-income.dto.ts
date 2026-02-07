import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateIncomeDto {
  @IsUUID()
  shopId: string;

  @IsUUID()
  paymentMethodId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
