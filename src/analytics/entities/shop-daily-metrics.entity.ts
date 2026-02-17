import { Entity, Unique, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('shop_daily_metrics')
@Unique(['shopId', 'date'])
@Index(['shopId', 'date'])
export class ShopDailyMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column({ type: 'date' }) // 🔥 DATE puro, sin hora
  date: string;

  @Column({ type: 'numeric', default: 0 })
  salesTotal: number;

  @Column({ type: 'int', default: 0 })
  salesCount: number;

  @Column({ type: 'numeric', default: 0 })
  purchasesTotal: number;

  @Column({ type: 'numeric', default: 0 })
  incomesTotal: number;

  @Column({ type: 'numeric', default: 0 })
  expensesTotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  saleReturnsTotal: number;
}
