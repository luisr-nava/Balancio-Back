import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopDailyMetrics } from './entities/shop-daily-metrics.entity';
import { ShopProductStats } from './entities/shop-product-stats.entity';
import { ShopStats } from './entities/shop_stats.entity';
import {
  ExpenseSubscriber,
  IncomeSubscriber,
  PurchaseSubscriber,
  SaleSubscriber,
} from './subscribers/analytics.subscriber';
import { Sale } from '@/sale/entities/sale.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { SaleReturn } from '@/sale-return/entities/sale-return.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [
    ShopModule,
    TypeOrmModule.forFeature([
      ShopDailyMetrics,
      ShopProductStats,
      ShopStats,
      Sale,
      SaleItem,
      SaleReturn,
      ShopProduct,
      UserShop,
    ]),
  ],
  providers: [
    AnalyticsService,
    SaleSubscriber,
    IncomeSubscriber,
    ExpenseSubscriber,
    PurchaseSubscriber,
  ],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
