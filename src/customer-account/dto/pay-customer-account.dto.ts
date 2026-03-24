import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PayCustomerAccountDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  shopId: string;

  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
