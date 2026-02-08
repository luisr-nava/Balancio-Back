import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Purchase } from './purchase.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Purchase)
  @JoinColumn({ name: 'purchaseId' })
  purchase: Purchase;

  @ManyToOne(() => ShopProduct)
  @JoinColumn({ name: 'shopProductId' })
  shopProduct: ShopProduct;

  @Column()
  quantity: number;

  @Column('float')
  unitCost: number;

  @Column('float')
  subtotal: number;
}
