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
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { User } from '@/auth/entities/user.entity';

@Entity()
@Index(['paymentMethodId'])
export class Income {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  paymentMethodId: string;

  @Column({ type: 'uuid', nullable: true })
  employeeId?: string | null;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'employeeId' })
  employee?: User | null;

  @OneToOne(() => CashMovement, { nullable: true })
  @JoinColumn()
  cashMovement?: CashMovement | null;
}
