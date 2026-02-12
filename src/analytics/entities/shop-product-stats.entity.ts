import { Entity, Unique, Index, PrimaryGeneratedColumn, Column } from 'typeorm';

import { ManyToOne, JoinColumn } from 'typeorm';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity('shop_product_stats')
@Unique(['shopId', 'shopProductId'])
@Index(['shopId'])
export class ShopProductStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  shopProductId: string;

  @ManyToOne(() => ShopProduct)
  @JoinColumn({ name: 'shopProductId' })
  shopProduct: ShopProduct;

  @Column({ type: 'numeric', default: 0 })
  totalQuantity: number;

  @Column({ type: 'numeric', default: 0 })
  totalAmount: number;
}

