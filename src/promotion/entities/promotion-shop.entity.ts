import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Promotion } from './promotion.entity';
import { Shop } from '@/shop/entities/shop.entity';

@Unique(['promotionId', 'shopId'])
@Index(['promotionId'])
@Index(['shopId'])
@Entity('promotion_shop')
export class PromotionShop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  promotionId: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Promotion, (p) => p.shops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;
}
