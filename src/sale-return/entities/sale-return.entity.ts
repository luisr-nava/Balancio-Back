import { Sale } from '@/sale/entities/sale.entity';
import { Shop } from '@/shop/entities/shop.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SaleReturnItem } from './sale-return-item.entity';
import { RefundMethod } from '../enums/refund-method.enum';
export enum SaleReturnStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
  COMPLETED = 'COMPLETED',
}

@Entity()
export class SaleReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column()
  shopId: string;

  @Column('float')
  total: number;

  @Column({ nullable: true })
  reason?: string;

  @Column({
    type: 'enum',
    enum: RefundMethod,
  })
  refundMethod: RefundMethod;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @ManyToOne(() => Sale, (sale) => sale.saleReturns)
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @OneToMany(() => SaleReturnItem, (item) => item.saleReturn, {
    cascade: true,
  })
  items: SaleReturnItem[];

  @Column({
    type: 'enum',
    enum: SaleReturnStatus,
  })
  status: SaleReturnStatus;
}
