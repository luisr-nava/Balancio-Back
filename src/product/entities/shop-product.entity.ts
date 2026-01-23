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

  @Column('float')
  costPrice: number;

  @Column('float')
  salePrice: number;

  @Column({ type: 'float', nullable: true })
  stock?: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  createdBy?: string | null;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ProductHistory, (ph) => ph.shopProduct)
  productHistories: ProductHistory[];

  @OneToMany(() => PurchaseItem, (pi) => pi.shopProduct)
  purchaseItems: PurchaseItem[];

  @OneToMany(() => SaleItem, (si) => si.shopProduct)
  saleItems: SaleItem[];

  @OneToMany(() => SaleReturnItem, (sri) => sri.shopProduct)
  saleReturnItems: SaleReturnItem[];

  @OneToMany(() => PurchaseReturnItem, (pri) => pri.shopProduct)
  purchaseReturnItems: PurchaseReturnItem[];

  @OneToMany(() => ReplacementItem, (ri) => ri.shopProduct)
  replacementItems: ReplacementItem[];

  @OneToMany(() => StockAlert, (sa) => sa.shopProduct)
  stockAlerts: StockAlert[];

  @ManyToOne(() => Product, (product) => product.shopProducts)
  product: Product;

  @ManyToOne(() => Shop, (shop) => shop.shopProducts)
  shop: Shop;
}
