export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PARTIAL = 'PARTIAL',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum SaleStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum InvoiceType {
  TICKET = 'TICKET',
  FACTURA_A = 'FACTURA_A',
  FACTURA_B = 'FACTURA_B',
  FACTURA_C = 'FACTURA_C',
  NOTA_CREDITO_A = 'NOTA_CREDITO_A',
  NOTA_CREDITO_B = 'NOTA_CREDITO_B',
  NOTA_CREDITO_C = 'NOTA_CREDITO_C',
}

export enum SaleHistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  CANCELLED = 'CANCELLED',
}

export enum SaleReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

export enum RefundType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  EXCHANGE = 'EXCHANGE',
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { User } from '@/auth/entities/user.entity';
import { Customer } from '@/customer/entities/customer.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { SaleHistory } from './sale-history.entity';
import { SaleItemHistory } from './sale-item-history.entity';
import { SaleItem } from './sale-item.entity';
import { SaleReturn } from './sale-return.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
@Entity()
@Index(['shopId', 'saleDate'])
@Index(['customerId', 'saleDate'])
@Index(['paymentMethodId'])
@Index(['status', 'paymentStatus'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column({ type: 'text', nullable: true })
  customerId?: string | null;

  @Column({ type: 'text', nullable: true })
  employeeId?: string | null;

  @Column({ type: 'text', nullable: true })
  cashRegisterId?: string | null;

  @Column()
  paymentMethodId: string;

  // Montos
  @Column('float')
  subtotal: number;

  @Column('float', { default: 0 })
  discountAmount: number;

  @Column('float', { default: 0 })
  taxAmount: number;

  @Column('float')
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PAID,
  })
  paymentStatus: PaymentStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  saleDate: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'text', nullable: true })
  invoiceNumber?: string | null;

  @Column({ type: 'enum', enum: InvoiceType, nullable: true })
  invoiceType?: InvoiceType | null;

  @Column({
    type: 'enum',
    enum: SaleStatus,
    default: SaleStatus.COMPLETED,
  })
  status: SaleStatus;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelledBy?: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string | null;

  @ManyToOne(() => Shop)
  shop: Shop;

  @ManyToOne(() => Customer, { nullable: true })
  customer?: Customer | null;

  @ManyToOne(() => User, { nullable: true })
  employee?: User | null;

  @ManyToOne(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @OneToMany(() => SaleItem, (item) => item.sale)
  items: SaleItem[];

  @OneToMany(() => SaleHistory, (h) => h.sale)
  history: SaleHistory[];

  @OneToMany(() => SaleItemHistory, (h) => h.sale)
  itemHistory: SaleItemHistory[];

  @OneToMany(() => SaleReturn, (sr) => sr.sale)
  saleReturns: SaleReturn[];

  // @OneToOne(() => CustomerAccountMovement, { nullable: true })
  // accountMovement?: CustomerAccountMovement | null;

  @OneToOne(() => CashMovement, { nullable: true })
  cashMovement?: CashMovement | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
