import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { Supplier } from '@/supplier/entities/supplier.entity';
import { SaleReturn } from '@/sale/entities/sale-return.entity';
import { PurchaseReturnItem } from './purchase-return-item.entity';
import { CreditNote } from './credit-note.entity';
import { MerchandiseReplacement } from './merchandise-replacement.entity';

export enum PurchaseReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
}

export enum ResolutionType {
  CREDIT_NOTE = 'CREDIT_NOTE',
  REPLACEMENT = 'REPLACEMENT',
  REFUND = 'REFUND',
}

export enum ReplacementStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PurchaseStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RefundType {
  CASH = 'CASH',
  CREDIT = 'CREDIT',
  EXCHANGE = 'EXCHANGE',
}

@Entity()
export class PurchaseReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  purchaseId?: string | null;

  @Column()
  supplierId: string;

  @Column()
  shopId: string;

  @Column({ nullable: true })
  saleReturnId?: string | null;

  @Column('float')
  totalAmount: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  returnDate: Date;

  @Column({
    type: 'enum',
    enum: PurchaseReturnStatus,
    default: PurchaseReturnStatus.PENDING,
  })
  status: PurchaseReturnStatus;

  @Column({
    type: 'enum',
    enum: ResolutionType,
    default: ResolutionType.CREDIT_NOTE,
  })
  resolutionType: ResolutionType;

  @Column()
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @ManyToOne(() => Shop)
  shop: Shop;

  @ManyToOne(() => SaleReturn, { nullable: true })
  saleReturn?: SaleReturn | null;

  @OneToMany(() => PurchaseReturnItem, (item) => item.purchaseReturn)
  items: PurchaseReturnItem[];

  @OneToOne(() => CreditNote, { nullable: true })
  creditNote?: CreditNote | null;

  @OneToOne(() => MerchandiseReplacement, { nullable: true })
  replacement?: MerchandiseReplacement | null;
}
