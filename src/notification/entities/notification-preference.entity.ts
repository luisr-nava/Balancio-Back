import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { NotificationType } from '@/notification/entities/notification.entity';

@Entity('shop_notification_preferences')
@Unique(['shopId', 'type'])
export class ShopNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({ default: true })
  enabled: boolean;

  /**
   * Optional threshold for LOW_STOCK notifications.
   * When set, the user is notified when stock falls below this value.
   */
  @Column({ type: 'int', nullable: true, default: null })
  threshold: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
