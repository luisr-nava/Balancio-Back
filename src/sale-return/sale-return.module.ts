import { Module } from '@nestjs/common';
import { SaleReturnService } from './sale-return.service';
import { SaleReturnController } from './sale-return.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleReturn } from './entities/sale-return.entity';
import { SaleReturnItem } from './entities/sale-return-item.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaleReturn,
      SaleReturnItem,
      Sale,
      SaleItem,
      CashMovement,
      ShopProduct,
    ]),
  ],
  controllers: [SaleReturnController],
  providers: [SaleReturnService],
  exports: [SaleReturnService],
})
export class SaleReturnModule {}
