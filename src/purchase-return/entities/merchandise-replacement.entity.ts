import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { PurchaseReturn } from './purchase-return.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { Supplier } from '@/supplier/entities/supplier.entity';
import { ReplacementItem } from './replacement-item.entity';
export enum ReplacementStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}
@Entity()
@Unique(['purchaseReturnId'])
export class MerchandiseReplacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseReturnId: string;

  @Column()
  supplierId: string;

  @Column()
  shopId: string;

  @Column({
    type: 'enum',
    enum: ReplacementStatus,
    default: ReplacementStatus.PENDING,
  })
  status: ReplacementStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  requestDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveryDate?: Date | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => PurchaseReturn)
  purchaseReturn: PurchaseReturn;

  @ManyToOne(() => Supplier)
  supplier: Supplier;

  @ManyToOne(() => Shop)
  shop: Shop;

  @OneToMany(() => ReplacementItem, (item) => item.replacement)
  items: ReplacementItem[];
}
