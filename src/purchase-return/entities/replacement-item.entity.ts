import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { MerchandiseReplacement } from './merchandise-replacement.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
export class ReplacementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  merchandiseReplacementId: string;

  @Column()
  shopProductId: string;

  @Column()
  requestedQuantity: number;

  @Column({ default: 0 })
  deliveredQuantity: number;

  @ManyToOne(() => MerchandiseReplacement, { onDelete: 'CASCADE' })
  replacement: MerchandiseReplacement;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;
}
