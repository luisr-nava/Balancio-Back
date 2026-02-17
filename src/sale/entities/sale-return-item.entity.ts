import { SaleReturn } from '@/sale-return/entities/sale-return.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity()
export class SaleReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleReturnId: string;

  @Column()
  shopProductId: string;

  @Column('decimal', { precision: 18, scale: 6 })
  quantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  refundAmount: number;

  @ManyToOne(() => SaleReturn, { onDelete: 'CASCADE' })
  saleReturn: SaleReturn;
}
