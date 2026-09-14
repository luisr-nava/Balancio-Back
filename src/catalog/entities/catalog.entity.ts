import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';

export type CatalogProduct = {
  productId: string;
  shopProductId: string | null;
  name: string;
  description: string | null;
  barcode: string;
  imageUrl: string | null;
  salePrice: number;
  stock: number | null;
  currency: string;
  isActive: boolean;
  measurementUnit: { id: string; name: string } | null;
  categoryName: string | null;
  supplierName: string | null;
};

export type CatalogSnapshot = {
  version: number;
  products: CatalogProduct[];
};

@Entity('catalogs')
@Index(['shopId', 'createdAt'])
export class Catalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @Column({ type: 'jsonb' })
  snapshot: CatalogSnapshot;

  @Column({ type: 'int', default: 0 })
  productCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
