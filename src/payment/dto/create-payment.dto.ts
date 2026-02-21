import { IsEnum, IsUUID, IsNumber } from 'class-validator';
import { PaymentProvider } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  saleId: string;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @IsNumber()
  amount: number;
}
