import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { ProductCategory } from '../../product-category/entities/product-category.entity';
import { Supplier } from '@/supplier/entities/supplier.entity';
import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { ShopProduct } from './shop-product.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // @Column({ type: 'text', nullable: true, unique: true })
  // barcode?: string | null;

  @Column()
  measurementUnitId: string;

  @ManyToOne(() => MeasurementUnit)
  measurementUnit: MeasurementUnit;

  @Column({ default: false })
  allowPriceOverride: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => ShopProduct, (sp) => sp.product)
  shopProducts: ShopProduct[];

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    nullable: true,
  })
  category?: ProductCategory | null;

  @ManyToOne(() => Supplier, (supplier) => supplier.products, {
    nullable: true,
  })
  supplier?: Supplier | null;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  imagePublicId?: string | null;
}
