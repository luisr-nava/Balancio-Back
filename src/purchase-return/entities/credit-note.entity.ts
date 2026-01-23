export enum CreditNoteStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_USED = 'PARTIALLY_USED',
  FULLY_USED = 'FULLY_USED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { PurchaseReturn } from './purchase-return.entity';
import { Supplier } from '@/supplier/entities/supplier.entity';
import { CreditNoteApplication } from './credit-note-application.entity';

@Entity()
@Unique(['purchaseReturnId'])
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseReturnId: string;

  @Column()
  supplierId: string;

  @Column()
  shopId: string;

  @Column('float')
  amount: number;

  @Column('float')
  remainingAmount: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  issueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate?: Date | null;

  @Column({
    type: 'enum',
    enum: CreditNoteStatus,
    default: CreditNoteStatus.ACTIVE,
  })
  status: CreditNoteStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => PurchaseReturn)
  purchaseReturn: PurchaseReturn;

  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @ManyToOne(() => Shop)
  shop: Shop;

  @OneToMany(
    () => CreditNoteApplication,
    (application) => application.creditNote,
  )
  applications: CreditNoteApplication[];
}
