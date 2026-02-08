import { Module } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { ProductHistory } from '@/product/entities/product-history.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashRegisterModule } from '@/cash-register/cash-register.module';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseItem,
      ShopProduct,
      ProductHistory,
      PaymentMethod,
      CashMovement,
    ]),
    CashRegisterModule, // 👈 ACÁ
    CashMovementModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
