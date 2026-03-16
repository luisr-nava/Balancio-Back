import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  SALE_CANCELED = 'SALE_CANCELED',
  LOW_STOCK = 'LOW_STOCK',
  CASH_CLOSED = 'CASH_CLOSED',
  CASH_OPENED = 'CASH_OPENED',
}

export enum NotificationSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
}

@Entity('notifications')
@Index(['userId'])
@Index(['read'])
@Index(['createdAt'])
@Index(['deduplicationKey'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  shopId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  message: string;

  @Column({
    type: 'enum',
    enum: NotificationSeverity,
  })
  severity: NotificationSeverity;

  @Column({ default: false })
  read: boolean;

  /**
   * Clave opcional para deduplicación.
   * Si se proporciona, el servicio evita crear una notificación duplicada
   * con la misma clave en las últimas 24 horas.
   * Formato sugerido: "{TYPE}:{entityId}:{userId}:{YYYY-MM-DD}"
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  deduplicationKey: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
