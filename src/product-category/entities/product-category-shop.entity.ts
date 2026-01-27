import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { Shop } from '@/shop/entities/shop.entity';

@Entity()
@Unique(['categoryId', 'shopId'])
export class CategoryProductShop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  categoryId: string;

  @Column()
  shopId: string;

  @ManyToOne(() => ProductCategory, (c) => c.categoryProductShops)
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory;

  @ManyToOne(() => Shop, (s) => s.categoryProductShops)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
