import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Purchase } from './purchase.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
export class PurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseId: string;

  @Column()
  shopProductId: string;

  @Column()
  quantity: number;

  @Column('float')
  unitCost: number;

  @Column('float')
  subtotal: number;

  @ManyToOne(() => Purchase)
  purchase: Purchase;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;
}
