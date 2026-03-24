import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  SALE_CREATED = 'SALE_CREATED',
  SALE_CANCELED = 'SALE_CANCELED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  LOW_STOCK = 'LOW_STOCK',
  CASH_CLOSED = 'CASH_CLOSED',
  CASH_OPENED = 'CASH_OPENED',
  EMPLOYEE_CREATED = 'EMPLOYEE_CREATED',
  PROMOTION_CREATED = 'PROMOTION_CREATED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
}

/**
 * Index strategy (every index has a concrete access pattern):
 *
 *   (userId, createdAt)         — default inbox: WHERE userId = ? ORDER BY createdAt DESC
 *   (userId, isRead)            — unread-count badge: WHERE userId = ? AND isRead = false
 *   (userId, type, createdAt)   — type-filtered inbox: WHERE userId = ? AND type = ? ORDER BY createdAt DESC
 *   (userId, shopId, createdAt) — shop-filtered inbox: WHERE userId = ? AND shopId = ? ORDER BY createdAt DESC
 *   deduplicationKey (partial)  — dedup lookup; partial skips the majority-NULL rows,
 *                                 keeping the index small and writes fast
 */
@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'isRead'])
@Index(['userId', 'type', 'createdAt'])
@Index(['userId', 'shopId', 'createdAt'])
@Index(['deduplicationKey'], { where: '"deduplicationKey" IS NOT NULL' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /** Nullable: system-level notifications (e.g. EMPLOYEE_CREATED) have no shop context. */
  @Column({ type: 'uuid', nullable: true, default: null })
  shopId: string | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationSeverity,
  })
  severity: NotificationSeverity;

  @Column({ default: false })
  isRead: boolean;

  /**
   * Optional JSON payload for dynamic data (e.g. saleId, amount, productId).
   * Keep small — never store full entity snapshots here.
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  metadata: Record<string, unknown> | null;

  /**
   * Optional deduplication key.
   * If provided, the service will not create another notification with the
   * same key within the last 24 hours.
   * Suggested format: "{TYPE}:{entityId}:{userId}:{YYYY-MM-DD}"
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  deduplicationKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
