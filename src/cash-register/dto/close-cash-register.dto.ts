import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CloseCashRegisterDto {
  @IsNumber()
  actualAmount: number;

  @IsOptional()
  @IsNumber()
  closingAmount?: number;

  @IsOptional()
  @IsString()
  closingNotes?: string;

}
