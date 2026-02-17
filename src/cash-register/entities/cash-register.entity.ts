import { Shop } from '@/shop/entities/shop.entity';

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
  SALE_RETURN = 'SALE_RETURN',
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
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CashRegisterStatus } from '../enums/cash-register-status.enum';

@Entity('cash_registers')
@Index(['shopId', 'status'])
@Index(['openedAt'])
export class CashRegister {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  openingAmount: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  openedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  openedByUserId?: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  openedByName?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  closingAmount?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualAmount?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  difference?: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  closedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  closedBy?: string;

  @Column({ type: 'text', nullable: true })
  closingNotes?: string;

  @Column({
    type: 'enum',
    enum: CashRegisterStatus,
    default: CashRegisterStatus.OPEN,
  })
  status: CashRegisterStatus;

  // Relaciones mínimas
  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;
}
