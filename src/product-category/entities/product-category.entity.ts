import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { Product } from '@/product/entities/product.entity';

@Entity()
@Unique(['name', 'shopId'])
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  shopId: string;

  // Auditoría
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  createdBy?: string | null;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  updatedBy?: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  disabledBy?: string | null;

  // Relaciones
  @ManyToOne(() => Shop, (shop) => shop.productCategories)
  shop: Shop;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
