import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './helpers/analytics-period.helper';

import { ShopDailyMetrics } from './entities/shop-daily-metrics.entity';
import { ShopProductStats } from './entities/shop-product-stats.entity';
import { ShopStats } from './entities/shop_stats.entity';
import { Sale } from '@/sale/entities/sale.entity';

export type PeriodType = 'day' | 'week' | 'month' | 'year';

export interface Metrics {
  series: {
    label: string;
    value: number;
  }[];
  total: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ShopDailyMetrics)
    private readonly dailyRepo: Repository<ShopDailyMetrics>,

    @InjectRepository(ShopProductStats)
    private readonly productStatsRepo: Repository<ShopProductStats>,

    @InjectRepository(ShopStats)
    private readonly shopStatsRepo: Repository<ShopStats>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
  ) {}

  async getShopDashboardAnalytics(
    shopId: string,
    period: PeriodType = 'day',
    date?: string,
    timezone = 'UTC',
  ) {
    const reference = date ? new Date(date) : new Date();

    const { startDate, endDate } = this.getPeriodRange(
      period,
      reference,
      timezone,
    );

    const [
      sales,
      purchases,
      incomes,
      expenses,
      saleReturn,
      topProducts,
      bestSale,
    ] = await Promise.all([
      this.buildModuleSeries(shopId, 'salesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'purchasesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'incomesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'expensesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'saleReturnsTotal', startDate, endDate),
      this.buildTopProducts(shopId),
      this.buildBestSale(shopId),
    ]);

    return {
      period,
      range: {
        from: startDate,
        to: endDate,
      },
      saleReturn,
      sales,
      purchases,
      incomes,
      expenses,
      topProducts,
      bestSale,
    };
  }

  private async buildModuleSeries(
    shopId: string,
    field: keyof ShopDailyMetrics,
    startDate: Date,
    endDate: Date,
  ): Promise<Metrics> {
    const records = await this.dailyRepo.find({
      where: {
        shopId,
        date: Between(
          this.normalizeDate(startDate),
          this.normalizeDate(endDate),
        ),
      },
      order: { date: 'ASC' },
    });

    const series = records.map((r) => ({
      label: r.date,
      value: Number(r[field] ?? 0),
    }));

    const total = series.reduce((sum, s) => sum + s.value, 0);

    return { series, total };
  }

  private async buildTopProducts(shopId: string) {
    const stats = await this.productStatsRepo.find({
      where: { shopId },
      order: { totalQuantity: 'DESC' },
      take: 5,
      relations: {
        shopProduct: {
          product: true,
        },
      },
    });

    return stats.map((s) => ({
      shopProductId: s.shopProductId,
      productId: s.shopProduct?.product?.id ?? null,
      name: s.shopProduct?.product?.name ?? null,
      quantitySold: Number(s.totalQuantity),
      totalAmount: Number(s.totalAmount),
    }));
  }

  private async buildBestSale(shopId: string) {
    const stats = await this.shopStatsRepo.findOne({
      where: { shopId },
    });

    if (!stats?.bestSaleId) return null;

    const sale = await this.saleRepo.findOne({
      where: { id: stats.bestSaleId },
      relations: {
        employee: true,
      },
    });

    if (!sale) return null;

    return {
      saleId: sale.id,
      total: Number(sale.totalAmount),
      date: sale.saleDate,
      performedBy: {
        id: sale.employee?.id ?? 'OWNER',
        fullName: sale.employee?.fullName ?? null,
        role: sale.employee ? 'EMPLOYEE' : 'OWNER',
      },
    };
  }

  private getPeriodRange(
    period: PeriodType,
    reference: Date,
    timezone: string,
  ) {
    switch (period) {
      case 'day':
        return {
          startDate: reference,
          endDate: reference,
        };
      case 'week':
        return {
          startDate: startOfWeek(reference, timezone),
          endDate: endOfWeek(reference, timezone),
        };
      case 'month':
        return {
          startDate: startOfMonth(reference, timezone),
          endDate: endOfMonth(reference, timezone),
        };
      case 'year':
        return {
          startDate: startOfYear(reference, timezone),
          endDate: endOfYear(reference, timezone),
        };
    }
  }

  private normalizeDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
