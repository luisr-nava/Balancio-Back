import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  IsString,
} from 'class-validator';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';

export class CreateCashMovementDto {
  @IsUUID()
  cashRegisterId: string;

  @IsUUID()
  shopId: string;

  @IsEnum(CashMovementType)
  type: CashMovementType;

  @IsNumber()
  amount: number;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Solo UNO de estos debe venir
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @IsOptional()
  @IsUUID()
  saleReturnId?: string;

  @IsOptional()
  @IsUUID()
  incomeId?: string;

  @IsOptional()
  @IsUUID()
  expenseId?: string;
}
