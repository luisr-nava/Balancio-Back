import { SaleItem } from '@/sale/entities/sale-item.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SaleReturn } from './sale-return.entity';
import { ReturnCondition } from '../dto/create-sale-return.dto';

@Entity()
export class SaleReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleReturnId: string;

  @Column('decimal', { precision: 18, scale: 6 })
  quantity: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  unitPrice: number;

  @ManyToOne(() => SaleReturn, (saleReturn) => saleReturn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'saleReturnId' })
  saleReturn: SaleReturn;

  @ManyToOne(() => SaleItem, (saleItem) => saleItem.saleReturnItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'saleItemId' })
  saleItem: SaleItem;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  refundAmount: number;

  @Column()
  shopProductId: string;

  @Column({
    
    type: 'enum',
    enum: ReturnCondition,
    default: ReturnCondition.SELLABLE,
  })
  returnCondition: ReturnCondition;
}
