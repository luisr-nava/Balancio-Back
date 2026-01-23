import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
@Index(['shopId', 'isResolved'])
@Index(['shopProductId', 'isResolved'])
export class StockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  shopProductId: string;

  // Stock info
  @Column()
  currentStock: number;

  @Column()
  threshold: number;

  // Estado
  @Column({ default: false })
  isResolved: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;

  // Metadata
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  notifiedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  notificationId?: string | null;

  // Relaciones
  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @ManyToOne(() => ShopProduct, { onDelete: 'CASCADE' })
  shopProduct: ShopProduct;
}
