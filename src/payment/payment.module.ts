import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { Payment } from './entities/payment.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Sale, CashMovement])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
