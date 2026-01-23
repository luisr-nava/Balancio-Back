import { Shop } from '@/shop/entities/shop.entity';
export enum CashRegisterStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum CashMovementType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  RETURN = 'RETURN',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  OPENING = 'OPENING',
  WITHDRAWAL = 'WITHDRAWAL',
  DEPOSIT = 'DEPOSIT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum CashRegisterExportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { CashRegisterExport } from './cash-register-export.entity';
import { CashMovement } from './cash-movement.entity';

@Entity()
@Index(['shopId', 'status'])
@Index(['openedAt'])
export class CashRegister {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  employeeId: string;

  @Column('float')
  openingAmount: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  openedAt: Date;

  @Column({ type: 'text', nullable: true })
  openedByUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  openedByName?: string | null;

  @Column('float', { nullable: true })
  closingAmount?: number | null;

  @Column('float', { nullable: true })
  actualAmount?: number | null;

  @Column('float', { nullable: true })
  difference?: number | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  closedBy?: string | null;

  @Column({ type: 'text', nullable: true })
  closingNotes?: string | null;

  @Column({
    type: 'enum',
    enum: CashRegisterStatus,
    default: CashRegisterStatus.OPEN,
  })
  status: CashRegisterStatus;

  @ManyToOne(() => Shop, (shop) => shop.cashRegisters)
  shop: Shop;

  @OneToMany(() => CashMovement, (movement) => movement.cashRegister)
  movements: CashMovement[];

  @OneToMany(() => CashRegisterExport, (exp) => exp.cashRegister)
  exports: CashRegisterExport[];
}
