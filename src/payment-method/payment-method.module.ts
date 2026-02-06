import { Module } from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { PaymentMethodController } from './payment-method.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { ShopPaymentMethod } from './entities/shop-payment-method.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { Income } from '@/income/entities/income.entity';
import { Expense } from '@/expense/entities/expense.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentMethod,
      Shop,
      UserShop,
      ShopPaymentMethod,
      Sale,
      Purchase,
      Income,
      Expense,
    ]),
  ],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}
