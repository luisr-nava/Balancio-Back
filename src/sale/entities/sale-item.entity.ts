import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Sale } from './sale.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Index(['saleId'])
@Index(['shopProductId'])
@Entity()
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column()
  shopProductId: string;

  @Column('decimal', { precision: 18, scale: 6 })
  quantity: string; // balanza friendly

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;

  @Column('float', { default: 0 })
  discount: number;

  @Column('float', { default: 0 })
  taxRate: number;

  @Column('float', { default: 0 })
  taxAmount: number;

  @Column('float')
  total: number;

  @Column({ default: false })
  priceWasModified: boolean;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  sale: Sale;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
