import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { CashMovementType, CashRegister } from './cash-register.entity';
import { Expense } from '@/expense/entities/expense.entity';
import { Income } from '@/income/entities/income.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { SaleReturn } from '@/sale/entities/sale-return.entity';
import { Sale } from '@/sale/entities/sale.entity';

@Entity()
@Index(['cashRegisterId', 'createdAt'])
@Index(['shopId', 'createdAt'])
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cashRegisterId: string;

  @Column()
  shopId: string;

  @Column({
    type: 'enum',
    enum: CashMovementType,
  })
  type: CashMovementType;

  @Column('float')
  amount: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ nullable: true, unique: true })
  saleId?: string | null;

  @Column({ nullable: true, unique: true })
  purchaseId?: string | null;

  @Column({ nullable: true, unique: true })
  saleReturnId?: string | null;

  @Column({ nullable: true, unique: true })
  incomeId?: string | null;

  @Column({ nullable: true, unique: true })
  expenseId?: string | null;

  @Column()
  userId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => CashRegister, (cr) => cr.movements)
  cashRegister: CashRegister;

  @ManyToOne(() => Sale, { nullable: true })
  sale?: Sale | null;

  @ManyToOne(() => Purchase, { nullable: true })
  purchase?: Purchase | null;

  @ManyToOne(() => SaleReturn, { nullable: true })
  saleReturn?: SaleReturn | null;

  @ManyToOne(() => Income, { nullable: true })
  income?: Income | null;

  @ManyToOne(() => Expense, { nullable: true })
  expense?: Expense | null;
}
