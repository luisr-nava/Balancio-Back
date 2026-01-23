import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { CashMovement } from '@/cash-register/entities/cash-movement.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';

@Entity()
@Index(['paymentMethodId'])
export class Income {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  paymentMethodId: string;

  @Column('float')
  amount: number;

  @Column()
  description: string;

  @Column({ type: 'varchar', nullable: true })
  category?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date: Date;

  @Column({ type: 'varchar', nullable: true })
  createdBy?: string | null;

  // Relaciones
  @ManyToOne(() => Shop)
  shop: Shop;

  @ManyToOne(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @OneToOne(() => CashMovement, { nullable: true })
  @JoinColumn()
  cashMovement?: CashMovement | null;
}
