import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { User } from '@/auth/entities/user.entity';

@Entity('subscription')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'uuid', unique: true })
  ownerId: string;

  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId?: string;

  @Column({ type: 'varchar', nullable: true })
  stripeSubscriptionId?: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd?: Date;

  // 🧾 Plan interno (basic | premium | etc)
  @Column({
    type: 'enum',
    enum: ['FREE', 'BASIC', 'PRO'],
    default: 'FREE',
  })
  plan: 'FREE' | 'BASIC' | 'PRO';

  @Column({
    type: 'enum',
    enum: ['BASIC', 'PRO'],
    nullable: true,
  })
  pendingPlan?: 'BASIC' | 'PRO';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
