import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { Promotion } from './promotion.entity';

@Entity()
@Index(['promotionId'])
@Index(['shopProductId'])
export class PromotionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  promotionId: string;

  @Column()
  shopProductId: string;

  /** Minimum quantity that must be in the cart to satisfy this condition. */
  @Column('float')
  quantity: number;

  @ManyToOne(() => Promotion, (p) => p.items, { onDelete: 'CASCADE' })
  promotion: Promotion;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;
}
