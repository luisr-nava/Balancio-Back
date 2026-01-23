import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { PurchaseReturn } from './purchase-return.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
export class PurchaseReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseReturnId: string;

  @Column()
  shopProductId: string;

  @Column()
  quantity: number;

  @Column('float')
  unitCost: number;

  @Column('float')
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @ManyToOne(() => PurchaseReturn, { onDelete: 'CASCADE' })
  purchaseReturn: PurchaseReturn;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;
}
