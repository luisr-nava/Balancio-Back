import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { PurchaseStatus } from '@/purchase-return/entities/purchase-return.entity';
import { ProductHistory } from '@/product/entities/product-history.entity';
import { Supplier } from '@/supplier/entities/supplier.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { PurchaseItem } from './purchase-item.entity';
import { CreditNoteApplication } from '@/purchase-return/entities/credit-note-application.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';

@Entity()
@Index(['paymentMethodId'])
@Index(['shopId', 'purchaseDate'])
@Index(['status'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  paymentMethodId: string;

  @Column('float', { nullable: true })
  totalAmount?: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  purchaseDate: Date;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.COMPLETED,
  })
  status: PurchaseStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  cancelledBy?: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string | null;

  @OneToMany(() => ProductHistory, (ph) => ph.purchase)
  histories: ProductHistory[];

  @ManyToOne(() => Shop)
  shop: Shop;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier | null;

  @ManyToOne(() => PaymentMethod)
  paymentMethod: PaymentMethod;

  @OneToMany(() => PurchaseItem, (item) => item.purchase)
  items: PurchaseItem[];

  @OneToMany(() => CreditNoteApplication, (app) => app.purchase)
  creditNoteApplications: CreditNoteApplication[];

  @OneToOne(() => CashMovement, { nullable: true })
  cashMovement?: CashMovement | null;
}
