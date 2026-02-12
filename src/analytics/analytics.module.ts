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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopDailyMetrics,
      ShopProductStats,
      ShopStats,
      Sale,
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
