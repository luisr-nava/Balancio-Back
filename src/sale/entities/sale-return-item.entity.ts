import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { SaleReturn } from './sale-return.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';

@Entity()
export class SaleReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleReturnId: string;

  @Column()
  shopProductId: string;

  @Column()
  quantity: number;

  @Column('float')
  unitPrice: number;

  @Column('float')
  subtotal: number;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'text', nullable: true })
  condition?: string | null;

  @ManyToOne(() => SaleReturn, { onDelete: 'CASCADE' })
  saleReturn: SaleReturn;

  @ManyToOne(() => ShopProduct)
  shopProduct: ShopProduct;
}
