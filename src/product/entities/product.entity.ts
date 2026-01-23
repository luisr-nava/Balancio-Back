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

  @Column({ type: 'text', nullable: true })
  barcode?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  taxCategory?: string | null;

  @Column('float', { nullable: true })
  taxRate?: number | null;

  @Column({ default: false })
  allowPriceOverride: boolean;

  @Column({ nullable: true })
  supplierId?: string | null;

  @ManyToOne(() => Supplier, { nullable: true })
  supplier?: Supplier | null;

  @Column({ nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => ProductCategory, { nullable: true })
  category?: ProductCategory | null;

  @Column()
  measurementUnitId: string;

  @ManyToOne(() => MeasurementUnit)
  measurementUnit: MeasurementUnit;

  @OneToMany(() => ShopProduct, (sp) => sp.product)
  shopProducts: ShopProduct[];
}
