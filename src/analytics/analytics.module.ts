import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { User } from '@/auth/entities/user.entity';
import { Expense } from '@/expense/entities/expense.entity';
import { Income } from '@/income/entities/income.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { Sale } from '@/sale/entities/sale.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shop,
      Sale,
      SaleItem,
      Purchase,
      Income,
      Expense,
      User,
      ShopProduct,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
