import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '@/product/entities/product.entity';
import { CategoryProductShop } from './product-category-shop.entity';
import { User } from '@/auth/entities/user.entity';

@Entity()
export class ProductCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

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

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  createdByUser: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'updatedBy' })
  updatedByUser: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'disabledBy' })
  disabledByUser: User;

  // Relaciones
  @OneToMany(() => CategoryProductShop, (cs) => cs.category)
  categoryProductShops: CategoryProductShop[];

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
  })
  category?: ProductCategory | null;
  
  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
