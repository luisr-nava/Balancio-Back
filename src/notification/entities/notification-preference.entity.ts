import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '@/auth/entities/user.entity';
import { NotificationType } from '@/notification/entities/notification.entity';

@Entity('user_notification_preferences')
@Unique(['userId', 'type'])
export class UserNotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

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
