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

  @CreateDateColumn()
  createdAt: Date;
}
