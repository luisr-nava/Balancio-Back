import { Shop } from '@/shop/entities/shop.entity';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  BucketUnit,
  endOfMonth,
  endOfWeek,
  endOfYear,
  resolveAnalyticsPeriodRange,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from './helpers/analytics-period.helper';

import type {
  AnalyticsResponse,
  BestSaleSummary,
  Metrics,
  TopProductSummary,
} from './interfaces/analytics-response.interface';
import { JwtPayload } from 'jsonwebtoken';
import { User } from '@/auth/entities/user.entity';
import { AnalyticsQueryDto, AnalyticsType } from './dto/analytics-query.dto';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { Expense } from '@/expense/entities/expense.entity';
import { Income } from '@/income/entities/income.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { Sale, SaleStatus } from '@/sale/entities/sale.entity';

type SeriesPoint = { label: string; value: number };
type MetricModule = 'sales' | 'purchases' | 'incomes' | 'expenses';

export type TopProductResult = {
  shopProductId: string;
  productId: string | null;
  name: string | null;
  quantitySold: number;
  totalAmount: number;
};

export type DashboardPeriodKey = 'week' | 'month' | 'year';
type DashboardPeriodDefinition = {
  startDate: Date;
  endDate: Date;
  bucketUnit: BucketUnit;
};
const DASHBOARD_PERIOD_KEYS: DashboardPeriodKey[] = ['week', 'month', 'year'];
type DashboardPeriods = Record<DashboardPeriodKey, DashboardPeriodDefinition>;
type TimeSeriesModule = MetricModule;

const METRIC_MODULES_BY_TYPE: Record<AnalyticsType, MetricModule[]> = {
  [AnalyticsType.ALL]: ['sales', 'purchases', 'incomes', 'expenses'],
  [AnalyticsType.SALES]: ['sales'],
  [AnalyticsType.PURCHASES]: ['purchases'],
  [AnalyticsType.INCOMES]: ['incomes'],
  [AnalyticsType.EXPENSES]: ['expenses'],
};

export type PerformedBy = {
  id: string;
  fullName: string | null;
  role: 'OWNER' | 'EMPLOYEE' | 'MANAGER';
};

export type BestSaleResult = {
  saleId: string;
  total: number;
  date: Date;
  performedBy: PerformedBy;
};

export type DashboardAnalyticsResult = {
  sales: Record<DashboardPeriodKey, Metrics>;
  purchases: Record<DashboardPeriodKey, Metrics>;
  incomes: Record<DashboardPeriodKey, Metrics>;
  expenses: Record<DashboardPeriodKey, Metrics>;
  topProducts: TopProductResult[];
  bestSale: BestSaleResult | null;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,

    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,

    @InjectRepository(Income)
    private readonly incomeRepo: Repository<Income>,

    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(ShopProduct)
    private readonly shopProductRepo: Repository<ShopProduct>,
  ) {}

  async getAnalytics(
    query: AnalyticsQueryDto,
    user: JwtPayload,
  ): Promise<AnalyticsResponse> {
    const shop = await this.shopRepo.findOne({
      where: { id: query.shopId },
      select: ['id', 'projectId', 'timezone', 'ownerId'],
    });

    if (!shop) {
      throw new BadRequestException('La tienda no existe');
    }

    await this.ensureShopAccess(shop.id, shop.projectId, user);

    const periodRange = resolveAnalyticsPeriodRange(
      query,
      shop.timezone ?? 'UTC',
    );

    const modules = this.getModulesForType(query.type);

    const metrics = await this.buildMetricsForModules(
      modules,
      shop.id,
      periodRange.startDate,
      periodRange.endDate,
      periodRange.bucketUnit,
    );

    const [topProducts, bestSale] = await Promise.all([
      this.buildTopProducts(
        shop.id,
        periodRange.startDate,
        periodRange.endDate,
      ),
      this.buildBestSaleForPeriod(
        shop.id,
        periodRange.startDate,
        periodRange.endDate,
        user,
        shop.ownerId,
      ),
    ]);

    const summaryTopProducts: TopProductSummary[] = topProducts.map(
      (entry) => ({
        productId: entry.productId,
        name: entry.name,
        quantity: entry.quantitySold,
        totalAmount: entry.totalAmount,
      }),
    );

    return {
      period: periodRange.period,
      range: periodRange.range,
      metrics,
      insights: {
        topProducts: summaryTopProducts,
        bestSale,
      },
    };
  }

  private getModulesForType(type?: AnalyticsType): MetricModule[] {
    return METRIC_MODULES_BY_TYPE[type ?? AnalyticsType.ALL];
  }

  private async buildMetricsForModules(
    modules: MetricModule[],
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<AnalyticsResponse['metrics']> {
    const entries = await Promise.all(
      modules.map(async (module) => {
        const metric = await this.buildSeriesForModule(
          module,
          shopId,
          startDate,
          endDate,
          bucketUnit,
        );
        return [module, metric] as const;
      }),
    );

    return Object.fromEntries(entries) as AnalyticsResponse['metrics'];
  }

  async getShopDashboardAnalytics(
    shopId: string,
    timezone = 'UTC',
    ownerId?: string,
    ownerFullName?: string | null,
  ): Promise<DashboardAnalyticsResult> {
    const periods = this.getDashboardPeriods(timezone);

    const [sales, purchases, incomes, expenses, topProducts, bestSale] =
      await Promise.all([
        this.buildModuleDashboardSeries('sales', shopId, periods),
        this.buildModuleDashboardSeries('purchases', shopId, periods),
        this.buildModuleDashboardSeries('incomes', shopId, periods),
        this.buildModuleDashboardSeries('expenses', shopId, periods),
        this.buildTopProducts(shopId),
        this.buildBestSale(shopId, ownerId, ownerFullName),
      ]);

    return {
      sales,
      purchases,
      incomes,
      expenses,
      topProducts,
      bestSale,
    };
  }

  private getDashboardPeriods(
    timezone: string,
    reference = new Date(),
  ): DashboardPeriods {
    const weekStart = startOfWeek(reference, timezone);
    const weekEnd = endOfWeek(reference, timezone);
    const monthStart = startOfMonth(reference, timezone);
    const monthEnd = endOfMonth(reference, timezone);
    const yearStart = startOfYear(reference, timezone);
    const yearEnd = endOfYear(reference, timezone);

    return {
      week: { startDate: weekStart, endDate: weekEnd, bucketUnit: 'day' },
      month: { startDate: monthStart, endDate: monthEnd, bucketUnit: 'day' },
      year: { startDate: yearStart, endDate: yearEnd, bucketUnit: 'month' },
    };
  }

  private async buildModuleDashboardSeries(
    module: TimeSeriesModule,
    shopId: string,
    periods: DashboardPeriods,
  ): Promise<Record<DashboardPeriodKey, Metrics>> {
    const results = {} as Record<DashboardPeriodKey, Metrics>;

    await Promise.all(
      DASHBOARD_PERIOD_KEYS.map(async (key) => {
        const period = periods[key];
        results[key] = await this.buildSeriesForModule(
          module,
          shopId,
          period.startDate,
          period.endDate,
          period.bucketUnit,
        );
      }),
    );

    return results;
  }

  private async buildSeriesForModule(
    module: TimeSeriesModule,
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<Metrics> {
    switch (module) {
      case 'sales':
        return this.buildSalesSeries(shopId, startDate, endDate, bucketUnit);
      case 'purchases':
        return this.buildPurchasesSeries(
          shopId,
          startDate,
          endDate,
          bucketUnit,
        );
      case 'incomes':
        return this.buildIncomesSeries(shopId, startDate, endDate, bucketUnit);
      case 'expenses':
        return this.buildExpensesSeries(shopId, startDate, endDate, bucketUnit);
    }
  }

  private async ensureShopAccess(
    shopId: string,
    projectId: string,
    user: JwtPayload,
  ) {
    if (projectId !== user.projectId) {
      throw new ForbiddenException('No tenés acceso a esta tienda');
    }

    if (user.role === 'EMPLOYEE') {
      const employee = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user.userShops', 'userShop')
        .where('user.id = :userId', { userId: user.id })
        .andWhere('userShop.shopId = :shopId', { shopId })
        .getOne();

      if (!employee) {
        throw new ForbiddenException('No tenés permiso para esta tienda');
      }
    }
  }

  private async buildSalesSeries(
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<Metrics> {
    const groups = await this.saleRepo
      .createQueryBuilder('sale')
      .select('sale.saleDate', 'date')
      .addSelect('SUM(sale.totalAmount)', 'amount')
      .where('sale.shopId = :shopId', { shopId })
      .andWhere('sale.status = :status', { status: 'COMPLETED' })
      .andWhere('sale.saleDate BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('sale.saleDate')
      .orderBy('sale.saleDate', 'ASC')
      .getRawMany();
    return this.buildSeriesFromGroups(
      groups.map((g) => ({
        date: new Date(g.date),
        amount: Number(g.amount),
      })),
      startDate,
      endDate,
      bucketUnit,
    );
  }

  private async buildPurchasesSeries(
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<Metrics> {
    const groups = await this.purchaseRepo
      .createQueryBuilder('purchase')
      .select('purchase.purchaseDate', 'date')
      .addSelect('SUM(purchase.totalAmount)', 'amount')
      .where('purchase.shopId = :shopId', { shopId })
      .andWhere('purchase.status = :status', { status: 'COMPLETED' })
      .andWhere('purchase.purchaseDate BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('purchase.purchaseDate')
      .orderBy('purchase.purchaseDate', 'ASC')
      .getRawMany();

    return this.buildSeriesFromGroups(
      groups.map((g) => ({
        date: new Date(g.date),
        amount: Number(g.amount),
      })),
      startDate,
      endDate,
      bucketUnit,
    );
  }

  private async buildIncomesSeries(
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<Metrics> {
    const groups = await this.incomeRepo
      .createQueryBuilder('income')
      .select('income.date', 'date')
      .addSelect('SUM(income.amount)', 'amount')
      .where('income.shopId = :shopId', { shopId })
      .andWhere('income.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('income.date')
      .orderBy('income.date', 'ASC')
      .getRawMany();

    return this.buildSeriesFromGroups(
      groups.map((g) => ({
        date: new Date(g.date),
        amount: Number(g.amount),
      })),
      startDate,
      endDate,
      bucketUnit,
    );
  }

  private async buildExpensesSeries(
    shopId: string,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Promise<Metrics> {
    const groups = await this.expenseRepo
      .createQueryBuilder('expense')
      .select('expense.date', 'date')
      .addSelect('SUM(expense.amount)', 'amount')
      .where('expense.shopId = :shopId', { shopId })
      .andWhere('expense.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .groupBy('expense.date')
      .orderBy('expense.date', 'ASC')
      .getRawMany();

    return this.buildSeriesFromGroups(
      groups.map((g) => ({
        date: new Date(g.date),
        amount: Number(g.amount),
      })),
      startDate,
      endDate,
      bucketUnit,
    );
  }

  private async buildTopProducts(
    shopId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopProductResult[]> {
    const qb = this.saleItemRepo
      .createQueryBuilder('item')
      .innerJoin('item.sale', 'sale')
      .select('item.shopProductId', 'shopProductId')
      .addSelect('SUM(item.quantity)', 'quantitySold')
      .addSelect('SUM(item.total)', 'totalAmount')
      .where('sale.shopId = :shopId', { shopId })
      .andWhere('sale.status = :status', { status: 'COMPLETED' });

    if (startDate && endDate) {
      qb.andWhere('sale.saleDate BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    const groups = await qb
      .groupBy('item.shopProductId')
      .orderBy('quantitySold', 'DESC')
      .limit(5)
      .getRawMany();

    if (groups.length === 0) {
      return [];
    }

    const products = await this.shopProductRepo.find({
      where: { id: In(groups.map((g) => g.shopProductId)) },
      relations: ['product'],
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return groups.map((entry) => {
      const shopProduct = productMap.get(entry.shopProductId);
      return {
        shopProductId: entry.shopProductId,
        productId: shopProduct?.productId ?? null,
        name: shopProduct?.product?.name ?? null,
        quantitySold: Number(entry.quantitySold ?? 0),
        totalAmount: Number(entry.totalAmount ?? 0),
      };
    });
  }

  private async buildBestSaleForPeriod(
    shopId: string,
    startDate: Date,
    endDate: Date,
    user: JwtPayload,
    ownerId?: string,
  ): Promise<BestSaleSummary | null> {
    const sale = await this.saleRepo.findOne({
      where: {
        shopId,
        status: 'COMPLETED',
        saleDate: Between(startDate, endDate),
      } as any,
      order: { totalAmount: 'DESC' },
      relations: ['employee', 'items'],
    });

    if (!sale) {
      return null;
    }

    let ownerFullName: string | null = null;

    if (!sale.employee && ownerId) {
      ownerFullName =
        (
          await this.userRepo.findOne({
            where: { id: ownerId },
            select: ['fullName'],
          })
        )?.fullName ?? null;
    }

    return {
      saleId: sale.id,
      date: sale.saleDate.toISOString(),
      total: sale.totalAmount,
      itemsCount: sale.items?.length ?? 0,
      name: sale.employee?.fullName ?? ownerFullName ?? user.fullName ?? null,
    };
  }

  private async buildBestSale(
    shopId: string,
    ownerId?: string,
    ownerFullName?: string | null,
  ): Promise<BestSaleResult | null> {
    const sale = await this.saleRepo.findOne({
      where: {
        shopId,
        status: SaleStatus.COMPLETED,
      },
      order: { totalAmount: 'DESC' },
    });

    if (!sale) {
      return null;
    }

    const performedBy: PerformedBy =
      sale.employeeId != null
        ? {
            id: sale.employeeId,
            fullName:
              (
                await this.userRepo.findOne({
                  where: { id: sale.employeeId },
                  select: ['fullName'],
                })
              )?.fullName ?? null,
            role: 'EMPLOYEE',
          }
        : {
            id: ownerId ?? 'OWNER',
            fullName: ownerFullName ?? null,
            role: 'OWNER',
          };

    return {
      saleId: sale.id,
      total: sale.totalAmount,
      date: sale.saleDate,
      performedBy,
    };
  }

  private buildSeriesFromGroups(
    entries: { date: Date; amount: number }[],
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Metrics {
    const bucketMap = new Map<string, number>();

    for (const entry of entries) {
      const normalizedDate = this.truncateToBucket(entry.date, bucketUnit);
      const label = this.formatLabel(normalizedDate, bucketUnit);
      bucketMap.set(label, (bucketMap.get(label) ?? 0) + entry.amount);
    }

    return this.buildSeriesFromBucketMap(
      bucketMap,
      startDate,
      endDate,
      bucketUnit,
    );
  }

  private buildSeriesFromBucketMap(
    bucketMap: Map<string, number>,
    startDate: Date,
    endDate: Date,
    bucketUnit: BucketUnit,
  ): Metrics {
    const series: SeriesPoint[] = [];
    const cursorEnd = this.truncateToBucket(endDate, bucketUnit);
    let cursor = this.truncateToBucket(startDate, bucketUnit);

    while (cursor <= cursorEnd) {
      const label = this.formatLabel(cursor, bucketUnit);
      series.push({ label, value: bucketMap.get(label) ?? 0 });
      cursor = this.incrementCursor(cursor, bucketUnit);
    }

    const total = series.reduce((sum, point) => sum + point.value, 0);
    return { series, total };
  }

  private formatLabel(date: Date, bucketUnit: BucketUnit) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    if (bucketUnit === 'month') {
      return `${year}-${month}`;
    }

    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private truncateToBucket(date: Date, bucketUnit: BucketUnit) {
    const normalized = new Date(date);
    normalized.setUTCHours(0, 0, 0, 0);

    if (bucketUnit === 'month') {
      normalized.setUTCDate(1);
    }

    return normalized;
  }

  private incrementCursor(date: Date, bucketUnit: BucketUnit) {
    const next = new Date(date);

    if (bucketUnit === 'month') {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(1);
      next.setUTCHours(0, 0, 0, 0);
      return next;
    }

    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }
}
