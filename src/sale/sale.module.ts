import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SaleHistory } from './entities/sale-history.entity';
import { SaleItemHistory } from './entities/sale-item-history.entity';
import { SaleReturn } from './entities/sale-return.entity';
import { SaleReturnItem } from './entities/sale-return-item.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashRegisterModule } from '@/cash-register/cash-register.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Sale,
      SaleItem,
      SaleHistory,
      SaleItemHistory,
      SaleReturn,
      SaleReturnItem,
      ShopProduct,
      CashMovement,
    ]),
    CashRegisterModule, // 👈 obligatorio para validar caja abierta/cerrada
  ],
  controllers: [SaleController],
  providers: [SaleService],
  exports: [SaleService],
})
export class SaleModule {}
