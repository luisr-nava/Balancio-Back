import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ShopProduct } from './shop-product.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';

@Entity()
export class ProductHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopProductId: string;

  @Column({ type: 'text', nullable: true })
  userId?: string | null;

  @Column({ type: 'text', nullable: true })
  purchaseId?: string | null;

  @Column()
  changeType: string;

  @Column('float', { nullable: true })
  previousCost?: number | null;

  @Column('float', { nullable: true })
  newCost?: number | null;

  @Column('float', { nullable: true })
  previousStock?: number | null;

  @Column('float', { nullable: true })
  newStock?: number | null;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Purchase, { nullable: true })
  purchase?: Purchase | null;

  @ManyToOne(() => ShopProduct, (sp) => sp.productHistories)
  shopProduct: ShopProduct;
}
