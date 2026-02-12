import { Entity, Unique, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('shop_stats')
@Unique(['shopId'])
export class ShopStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column({ type: 'uuid', nullable: true })
  bestSaleId: string | null;

  @Column({ type: 'numeric', default: 0 })
  bestSaleAmount: number;
}
