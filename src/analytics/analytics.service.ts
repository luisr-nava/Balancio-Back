import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  endOfMonth,
  endOfDay,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfDay,
  startOfWeek,
  startOfYear,
} from './helpers/analytics-period.helper';

import { ShopDailyMetrics } from './entities/shop-daily-metrics.entity';
import { ShopProductStats } from './entities/shop-product-stats.entity';
import { ShopStats } from './entities/shop_stats.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { SaleReturn } from '@/sale-return/entities/sale-return.entity';
import { User, UserRole } from '@/auth/entities/user.entity';
import { UserShop, UserShopRole } from '@/auth/entities/user-shop.entity';

export type PeriodType = 'day' | 'week' | 'month' | 'year';

export interface Metrics {
  series: {
    label: string;
    value: number;
  }[];
  total: number;
}

type ScopedSalesRow = {
  saleDate: string;
  totalAmount: string;
};

type ScopedSaleReturnRow = {
  createdAt: string;
  total: string;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(ShopDailyMetrics)
    private readonly dailyRepo: Repository<ShopDailyMetrics>,

    @InjectRepository(ShopProductStats)
    private readonly productStatsRepo: Repository<ShopProductStats>,

    @InjectRepository(ShopStats)
    private readonly shopStatsRepo: Repository<ShopStats>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(ShopProduct)
    private readonly shopProductRepo: Repository<ShopProduct>,

    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,

    @InjectRepository(SaleReturn)
    private readonly saleReturnRepo: Repository<SaleReturn>,

    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
  ) {}

  async getShopDashboardAnalytics(
    shopId: string,
    user: User,
    period: PeriodType = 'day',
    date?: string,
    timezone = 'UTC',
  ) {
    if (user.role !== UserRole.OWNER) {
      const userShop = await this.userShopRepo.findOne({
        where: { userId: user.id, shopId },
      });
      if (!userShop) {
        throw new Error('No tienes acceso a esta tienda');
      }
    }

    const reference = date ? new Date(date) : new Date();

    const { startDate, endDate } = this.getPeriodRange(
      period,
      reference,
      timezone,
    );

    if (user.role === UserRole.MANAGER) {
      return this.getManagerAnalytics(shopId, user.id, period, startDate, endDate);
    }

    if (user.role === UserRole.EMPLOYEE) {
      return this.getEmployeeAnalytics(
        shopId,
        user.id,
        period,
        startDate,
        endDate,
      );
    }

    return this.getOwnerAnalytics(shopId, period, startDate, endDate);
  }

  private async getOwnerAnalytics(
    shopId: string,
    period: PeriodType,
    startDate: Date,
    endDate: Date,
  ) {
    const [
      sales,
      purchases,
      incomes,
      expenses,
      saleReturn,
      topProducts,
      bestSale,
      summary,
      totalProducts,
    ] = await Promise.all([
      this.buildModuleSeries(shopId, 'salesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'purchasesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'incomesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'expensesTotal', startDate, endDate),
      this.buildModuleSeries(shopId, 'saleReturnsTotal', startDate, endDate),
      this.buildTopProducts(shopId),
      this.buildBestSale(shopId),
      this.buildSummary(shopId, startDate, endDate),
      this.buildTotalProducts(shopId),
    ]);

    return this.buildAnalyticsResponse(period, startDate, endDate, {
      summary,
      saleReturn,
      sales,
      purchases,
      incomes,
      expenses,
      topProducts,
      bestSale,
      totalProducts,
    });
  }

  private async getManagerAnalytics(
    shopId: string,
    managerId: string,
    period: PeriodType,
    startDate: Date,
    endDate: Date,
  ) {
    const employeeAssignments = await this.userShopRepo.find({
      where: { shopId, role: UserShopRole.EMPLOYEE },
      select: { userId: true },
    });

    const allowedUserIds = [
      ...new Set([managerId, ...employeeAssignments.map((assignment) => assignment.userId)]),
    ];

    return this.buildScopedAnalytics(
      shopId,
      allowedUserIds,
      period,
      startDate,
      endDate,
    );
  }

  private async getEmployeeAnalytics(
    shopId: string,
    userId: string,
    period: PeriodType,
    startDate: Date,
    endDate: Date,
  ) {
    return this.buildScopedAnalytics(
      shopId,
      [userId],
      period,
      startDate,
      endDate,
      { userId, shopId },
    );
  }

  private async buildScopedAnalytics(
    shopId: string,
    allowedUserIds: string[],
    period: PeriodType,
    startDate: Date,
    endDate: Date,
    logContext?: {
      userId: string;
      shopId: string;
    },
  ) {
    const [salesRows, saleReturnRows, topProducts, bestSale] = await Promise.all([
      this.getScopedSalesRows(shopId, allowedUserIds, startDate, endDate),
      this.getScopedSaleReturnRows(shopId, allowedUserIds, startDate, endDate),
      this.buildScopedTopProducts(shopId, allowedUserIds),
      this.buildScopedBestSale(shopId, allowedUserIds),
    ]);

    if (logContext) {
      this.logger.debug(
        JSON.stringify({
          userId: logContext.userId,
          shopId: logContext.shopId,
          resultCount: salesRows.length,
        }),
      );
    }

    const sales = this.buildMetricsFromRows(salesRows, 'saleDate', 'totalAmount');
    const saleReturn = this.buildMetricsFromRows(
      saleReturnRows,
      'createdAt',
      'total',
    );

    return this.buildAnalyticsResponse(period, startDate, endDate, {
      summary: this.buildScopedSummary(salesRows, saleReturnRows),
      saleReturn,
      sales,
      purchases: this.emptyMetrics(),
      incomes: this.emptyMetrics(),
      expenses: this.emptyMetrics(),
      topProducts,
      bestSale,
      totalProducts: 0,
    });
  }

  private buildAnalyticsResponse(
    period: PeriodType,
    startDate: Date,
    endDate: Date,
    payload: {
      summary: {
        totalSales: number;
        totalSaleReturns: number;
        netSales: number;
        totalExpenses: number;
        totalIncomes: number;
        balance: number;
        totalPurchases: number;
        totalSalesCount: number;
      };
      saleReturn: Metrics;
      sales: Metrics;
      purchases: Metrics;
      incomes: Metrics;
      expenses: Metrics;
      topProducts: {
        shopProductId: string;
        productId: string | null;
        name: string | null;
        quantitySold: number;
        totalAmount: number;
      }[];
      bestSale: {
        saleId: string;
        total: number;
        date: Date;
        performedBy: {
          id: string;
          fullName: string | null;
          role: string;
        };
      } | null;
      totalProducts: number;
    },
  ) {
    return {
      period,
      range: {
        from: startDate,
        to: endDate,
      },
      summary: payload.summary,
      saleReturn: payload.saleReturn,
      sales: payload.sales,
      purchases: payload.purchases,
      incomes: payload.incomes,
      expenses: payload.expenses,
      topProducts: payload.topProducts,
      bestSale: payload.bestSale,
      totalProducts: payload.totalProducts,
    };
  }

  private async getScopedSalesRows(
    shopId: string,
    allowedUserIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<ScopedSalesRow[]> {
    return this.saleRepo
      .createQueryBuilder('sale')
      .select('sale.saleDate', 'saleDate')
      .addSelect('sale.totalAmount', 'totalAmount')
      .where('sale.shopId = :shopId', { shopId })
      .andWhere('sale.employeeId IN (:...allowedUserIds)', { allowedUserIds })
      .andWhere('sale.saleDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('sale.saleDate', 'ASC')
      .getRawMany<ScopedSalesRow>();
  }

  private async getScopedSaleReturnRows(
    shopId: string,
    allowedUserIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<ScopedSaleReturnRow[]> {
    return this.saleReturnRepo
      .createQueryBuilder('saleReturn')
      .innerJoin('saleReturn.sale', 'sale')
      .select('saleReturn.createdAt', 'createdAt')
      .addSelect('saleReturn.total', 'total')
      .where('saleReturn.shopId = :shopId', { shopId })
      .andWhere('sale.employeeId IN (:...allowedUserIds)', { allowedUserIds })
      .andWhere('saleReturn.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('saleReturn.createdAt', 'ASC')
      .getRawMany<ScopedSaleReturnRow>();
  }

  private buildMetricsFromRows(
    rows: Array<Record<string, string>>,
    dateKey: string,
    valueKey: string,
  ): Metrics {
    const totalsByDate = new Map<string, number>();
    let total = 0;

    for (const row of rows) {
      const rawDate = row[dateKey];
      if (!rawDate) {
        continue;
      }

      const label = this.normalizeDate(new Date(rawDate));
      const value = Number(row[valueKey] ?? 0);

      totalsByDate.set(label, (totalsByDate.get(label) ?? 0) + value);
      total += value;
    }

    return {
      series: Array.from(totalsByDate.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([label, value]) => ({
          label,
          value,
        })),
      total,
    };
  }

  private buildScopedSummary(
    salesRows: ScopedSalesRow[],
    saleReturnRows: ScopedSaleReturnRow[],
  ) {
    const totalSales = salesRows.reduce(
      (sum, sale) => sum + Number(sale.totalAmount ?? 0),
      0,
    );
    const totalSaleReturns = saleReturnRows.reduce(
      (sum, saleReturn) => sum + Number(saleReturn.total ?? 0),
      0,
    );
    const netSales = totalSales - totalSaleReturns;

    return {
      totalSales,
      totalSaleReturns,
      netSales,
      totalExpenses: 0,
      totalIncomes: 0,
      balance: netSales,
      totalPurchases: 0,
      totalSalesCount: salesRows.length,
    };
  }

  private async buildScopedTopProducts(
    shopId: string,
    allowedUserIds: string[],
  ) {
    const rows = await this.saleItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .leftJoin('item.shopProduct', 'shopProduct')
      .leftJoin('shopProduct.product', 'product')
      .select('item.shopProductId', 'shopProductId')
      .addSelect('product.id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('MAX(item.productName)', 'fallbackProductName')
      .addSelect('SUM(CAST(item.quantity AS numeric))', 'quantitySold')
      .addSelect('SUM(item.total)', 'totalAmount')
      .where('sale.shopId = :shopId', { shopId })
      .andWhere('sale.employeeId IN (:...allowedUserIds)', { allowedUserIds })
      .groupBy('item.shopProductId')
      .addGroupBy('product.id')
      .addGroupBy('product.name')
      .orderBy('SUM(CAST(item.quantity AS numeric))', 'DESC')
      .addOrderBy('SUM(item.total)', 'DESC')
      .limit(5)
      .getRawMany<{
        shopProductId: string;
        productId: string | null;
        productName: string | null;
        fallbackProductName: string | null;
        quantitySold: string;
        totalAmount: string;
      }>();

    return rows.map((row) => ({
      shopProductId: row.shopProductId,
      productId: row.productId,
      name: row.productName ?? row.fallbackProductName ?? null,
      quantitySold: Number(row.quantitySold ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
    }));
  }

  private async buildScopedBestSale(
    shopId: string,
    allowedUserIds: string[],
  ) {
    const sale = await this.saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.employee', 'employee')
      .where('sale.shopId = :shopId', { shopId })
      .andWhere('sale.employeeId IN (:...allowedUserIds)', { allowedUserIds })
      .orderBy('sale.totalAmount', 'DESC')
      .addOrderBy('sale.saleDate', 'DESC')
      .getOne();

    if (!sale) {
      return null;
    }

    return {
      saleId: sale.id,
      total: Number(sale.totalAmount),
      date: sale.saleDate,
      performedBy: {
        id: sale.employee?.id ?? sale.employeeId ?? 'UNKNOWN',
        fullName: sale.employee?.fullName ?? null,
        role: sale.employee?.role ?? UserRole.EMPLOYEE,
      },
    };
  }

  private emptyMetrics(): Metrics {
    return {
      series: [],
      total: 0,
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

    const series = records.map((record) => ({
      label: record.date,
      value: Number(record[field] ?? 0),
    }));

    const total = series.reduce((sum, item) => sum + item.value, 0);

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

    return stats.map((stat) => ({
      shopProductId: stat.shopProductId,
      productId: stat.shopProduct?.product?.id ?? null,
      name: stat.shopProduct?.product?.name ?? null,
      quantitySold: Number(stat.totalQuantity),
      totalAmount: Number(stat.totalAmount),
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
          startDate: startOfDay(reference, timezone),
          endDate: endOfDay(reference, timezone),
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

  private async buildSummary(shopId: string, startDate: Date, endDate: Date) {
    const records = await this.dailyRepo.find({
      where: {
        shopId,
        date: Between(
          this.normalizeDate(startDate),
          this.normalizeDate(endDate),
        ),
      },
    });

    const totals = records.reduce(
      (accumulator, record) => {
        accumulator.sales += Number(record.salesTotal ?? 0);
        accumulator.saleReturns += Number(record.saleReturnsTotal ?? 0);
        accumulator.expenses += Number(record.expensesTotal ?? 0);
        accumulator.incomes += Number(record.incomesTotal ?? 0);
        accumulator.purchases += Number(record.purchasesTotal ?? 0);
        accumulator.salesCount += Number(record.salesCount ?? 0);
        accumulator.purchasesCount += Number(record.purchasesCount ?? 0);
        return accumulator;
      },
      {
        sales: 0,
        saleReturns: 0,
        expenses: 0,
        incomes: 0,
        purchases: 0,
        salesCount: 0,
        purchasesCount: 0,
      },
    );

    const netSales = totals.sales - totals.saleReturns;

    const balance =
      netSales + totals.incomes - totals.expenses - totals.purchases;

    return {
      totalSales: totals.sales,
      totalSaleReturns: totals.saleReturns,
      netSales,
      totalExpenses: totals.expenses,
      totalIncomes: totals.incomes,
      balance,
      totalPurchases: totals.purchasesCount,
      totalSalesCount: totals.salesCount,
    };
  }

  private async buildTotalProducts(shopId: string) {
    return this.shopProductRepo.count({
      where: { shopId },
    });
  }
}
