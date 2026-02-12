import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { ShopDailyMetrics } from '../entities/shop-daily-metrics.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { Income } from '@/income/entities/income.entity';
import { Expense } from '@/expense/entities/expense.entity';
import { ShopProductStats } from '../entities/shop-product-stats.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { ShopStats } from '../entities/shop_stats.entity';

function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function applyDelta(
  event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>,
  shopId: string,
  date: Date,
  field: 'salesTotal' | 'incomesTotal' | 'expensesTotal' | 'purchasesTotal',
  amount: number,
  countDelta = 0,
) {
  const repo = event.manager.getRepository(ShopDailyMetrics);
  const normalized = normalizeDate(date);

  let daily = await repo.findOne({
    where: { shopId, date: normalized },
  });

  if (!daily) {
    daily = repo.create({ shopId, date: normalized });
  }

  const currentValue = Number(daily[field] ?? 0);
  const delta = Number(amount ?? 0);

  daily[field] = currentValue + delta;

  if (field === 'salesTotal') {
    daily.salesCount = Number(daily.salesCount ?? 0) + countDelta;
  }

  await repo.save(daily);
}

@EventSubscriber()
export class SaleSubscriber implements EntitySubscriberInterface<Sale> {
  listenTo() {
    return Sale;
  }

  async afterInsert(event: InsertEvent<Sale>) {
    const sale = event.entity;
    if (!sale) return;

    // await applyDelta(
    //   event,
    //   sale.shopId,
    //   sale.saleDate,
    //   'salesTotal',
    //   sale.totalAmount,
    //   1,
    // );

    // 🔥 ACTUALIZAR SHOP PRODUCT STATS
    await applyDelta(
      event,
      sale.shopId,
      sale.saleDate,
      'salesTotal',
      sale.totalAmount,
      1,
    );

    const statsRepo = event.manager.getRepository(ShopStats);

    let stats = await statsRepo.findOne({
      where: { shopId: sale.shopId },
    });

    if (!stats) {
      stats = statsRepo.create({
        shopId: sale.shopId,
      });

      stats.bestSaleId = null;
      stats.bestSaleAmount = 0;
    }

    const currentBest = Number(stats.bestSaleAmount ?? 0);
    const newAmount = Number(sale.totalAmount ?? 0);

    if (newAmount > currentBest) {
      stats.bestSaleId = sale.id;
      stats.bestSaleAmount = newAmount;
      await statsRepo.save(stats);
    }
    // const itemRepo = event.manager.getRepository(SaleItem);
    // const statsRepo = event.manager.getRepository(ShopProductStats);

    // const items = await itemRepo.find({
    //   where: { saleId: sale.id },
    // });

    // for (const item of items) {
    //   let stat = await statsRepo.findOne({
    //     where: {
    //       shopId: sale.shopId,
    //       shopProductId: item.shopProductId,
    //     },
    //   });

    //   if (!stat) {
    //     stat = statsRepo.create({
    //       shopId: sale.shopId,
    //       shopProductId: item.shopProductId,
    //       totalQuantity: 0,
    //       totalAmount: 0,
    //     });
    //   }

    //   const quantity = Number(item.quantity ?? 0);
    //   const total = Number(item.total ?? 0);

    //   stat.totalQuantity = (stat.totalQuantity ?? 0) + quantity;
    //   stat.totalAmount = (stat.totalAmount ?? 0) + total;

    //   await statsRepo.save(stat);
    // }
  }

  async afterRemove(event: RemoveEvent<Sale>) {
    const sale = event.databaseEntity;
    if (!sale) return;

    await applyDelta(
      event,
      sale.shopId,
      sale.saleDate,
      'salesTotal',
      -sale.totalAmount,
      -1,
    );
  }

  async afterUpdate(event: UpdateEvent<Sale>) {
    if (!event.databaseEntity || !event.entity) return;

    const oldSale = event.databaseEntity as Sale;
    const newSale = event.entity as Sale;

    const delta = newSale.totalAmount - oldSale.totalAmount;

    await applyDelta(
      event,
      newSale.shopId,
      newSale.saleDate,
      'salesTotal',
      delta,
    );
  }
}

@EventSubscriber()
export class IncomeSubscriber implements EntitySubscriberInterface<Income> {
  listenTo() {
    return Income;
  }

  async afterInsert(event: InsertEvent<Income>) {
    const income = event.entity;
    if (!income) return;

    await applyDelta(
      event,
      income.shopId,
      income.date,
      'incomesTotal',
      income.amount,
    );
  }

  async afterRemove(event: RemoveEvent<Income>) {
    const income = event.databaseEntity;
    if (!income) return;

    await applyDelta(
      event,
      income.shopId,
      income.date,
      'incomesTotal',
      -income.amount,
    );
  }

  async afterUpdate(event: UpdateEvent<Income>) {
    if (!event.databaseEntity || !event.entity) return;

    const oldIncome = event.databaseEntity as Income;
    const newIncome = event.entity as Income;

    const delta = newIncome.amount - oldIncome.amount;

    await applyDelta(
      event,
      newIncome.shopId,
      newIncome.date,
      'incomesTotal',
      delta,
    );
  }
}

@EventSubscriber()
export class SaleItemSubscriber implements EntitySubscriberInterface<SaleItem> {
  listenTo() {
    return SaleItem;
  }

  async afterInsert(event: InsertEvent<SaleItem>) {
    const item = event.entity;
    if (!item) return;

    const saleRepo = event.manager.getRepository(Sale);
    const statsRepo = event.manager.getRepository(ShopProductStats);

    const sale = await saleRepo.findOne({
      where: { id: item.saleId },
    });

    if (!sale) return;

    let stat = await statsRepo.findOne({
      where: {
        shopId: sale.shopId,
        shopProductId: item.shopProductId,
      },
    });

    if (!stat) {
      stat = statsRepo.create({
        shopId: sale.shopId,
        shopProductId: item.shopProductId,
        totalQuantity: 0,
        totalAmount: 0,
      });
    }

    const quantity = Number(item.quantity ?? 0);
    const total = Number(item.total ?? 0);

    const currentQty = Number(stat.totalQuantity ?? 0);
    const currentAmount = Number(stat.totalAmount ?? 0);

    stat.totalQuantity = currentQty + quantity;
    stat.totalAmount = currentAmount + total;

    await statsRepo.save(stat);

    await statsRepo.save(stat);
  }
}

@EventSubscriber()
export class ExpenseSubscriber implements EntitySubscriberInterface<Expense> {
  listenTo() {
    return Expense;
  }

  async afterInsert(event: InsertEvent<Expense>) {
    const expense = event.entity;
    if (!expense) return;

    await applyDelta(
      event,
      expense.shopId,
      expense.date,
      'expensesTotal',
      expense.amount,
    );
  }

  async afterRemove(event: RemoveEvent<Expense>) {
    const expense = event.databaseEntity;
    if (!expense) return;

    await applyDelta(
      event,
      expense.shopId,
      expense.date,
      'expensesTotal',
      -expense.amount,
    );
  }

  async afterUpdate(event: UpdateEvent<Expense>) {
    if (!event.databaseEntity || !event.entity) return;

    const oldExpense = event.databaseEntity as Expense;
    const newExpense = event.entity as Expense;

    const delta = newExpense.amount - oldExpense.amount;

    await applyDelta(
      event,
      newExpense.shopId,
      newExpense.date,
      'expensesTotal',
      delta,
    );
  }
}

@EventSubscriber()
export class PurchaseSubscriber implements EntitySubscriberInterface<Purchase> {
  listenTo() {
    return Purchase;
  }

  async afterInsert(event: InsertEvent<Purchase>) {
    const purchase = event.entity;
    if (!purchase) return;

    await applyDelta(
      event,
      purchase.shopId,
      purchase.purchaseDate,
      'purchasesTotal',
      purchase.totalAmount ?? 0,
    );
  }

  async afterRemove(event: RemoveEvent<Purchase>) {
    const purchase = event.databaseEntity;
    if (!purchase) return;

    await applyDelta(
      event,
      purchase.shopId,
      purchase.purchaseDate,
      'purchasesTotal',
      -(purchase.totalAmount ?? 0),
    );
  }

  async afterUpdate(event: UpdateEvent<Purchase>) {
    if (!event.databaseEntity || !event.entity) return;

    const oldPurchase = event.databaseEntity as Purchase;
    const newPurchase = event.entity as Purchase;

    const delta =
      (newPurchase.totalAmount ?? 0) - (oldPurchase.totalAmount ?? 0);

    await applyDelta(
      event,
      newPurchase.shopId,
      newPurchase.purchaseDate,
      'purchasesTotal',
      delta,
    );
  }
}
