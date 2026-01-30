import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { ProductHistory } from './product-history.entity';
import { PurchaseReturnItem } from '@/purchase-return/entities/purchase-return-item.entity';
import { ReplacementItem } from '@/purchase-return/entities/replacement-item.entity';
import { PurchaseItem } from '@/purchase/entities/purchase-item.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { SaleReturnItem } from '@/sale/entities/sale-return-item.entity';
import { StockAlert } from '@/stock/entities/stock.entity';

@Entity()
@Unique(['shopId', 'productId'])
export class ShopProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  productId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column('float')
  costPrice: number;

  @Column('float')
  salePrice: number;

  @Column({ type: 'float', nullable: true })
  stock?: number | null;

  @Column({ type: 'float', nullable: true })
  taxRate?: number | null;

  @Column({ type: 'text', nullable: true })
  taxCategory?: string | null;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  createdBy?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Product, (product) => product.shopProducts)
  product: Product;

  @ManyToOne(() => Shop, (shop) => shop.shopProducts)
  shop: Shop;

  @OneToMany(() => ProductHistory, (ph) => ph.shopProduct)
  productHistories: ProductHistory[];

  @Column({ type: 'uuid', nullable: true })
  supplierId: string | null;
}
