import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { RefundType, Sale, SaleReturnStatus } from './sale.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { SaleReturnItem } from './sale-return-item.entity';
import { PurchaseReturn } from '@/purchase-return/entities/purchase-return.entity';
import { CashMovement } from '@/cash-register/entities/cash-movement.entity';

@Entity()
export class SaleReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  saleId?: string | null;

  @Column()
  shopId: string;

  @Column('float')
  totalAmount: number;

  @Column()
  reason: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  returnDate: Date;

  @Column({
    type: 'enum',
    enum: SaleReturnStatus,
    default: SaleReturnStatus.PENDING,
  })
  status: SaleReturnStatus;

  @Column({
    type: 'enum',
    enum: RefundType,
    default: RefundType.CASH,
  })
  refundType: RefundType;

  @Column('float')
  refundAmount: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => Sale, { nullable: true })
  sale?: Sale | null;

  @ManyToOne(() => Shop)
  shop: Shop;

  @OneToMany(() => SaleReturnItem, (item) => item.saleReturn)
  items: SaleReturnItem[];

  @OneToMany(() => PurchaseReturn, (pr) => pr.saleReturn)
  purchaseReturns: PurchaseReturn[];

  @OneToOne(() => CashMovement, { nullable: true })
  cashMovement?: CashMovement | null;
}
