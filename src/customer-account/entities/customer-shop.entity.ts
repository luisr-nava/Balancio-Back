import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Customer } from '@/customer/entities/customer.entity';
import { Shop } from '@/shop/entities/shop.entity';

@Entity('customer_shop')
@Unique(['customerId', 'shopId'])
@Index(['customerId', 'shopId'])
@Index(['shopId', 'currentDebt'])
export class CustomerShop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid' })
  shopId: string;

  /** Maximum credit allowed. 0 = no credit extended. */
  @Column('float', { default: 0 })
  creditLimit: number;

  /** Running total owed by the customer in this shop. Never negative. */
  @Column('float', { default: 0 })
  currentDebt: number;

  @Column({ default: false })
  isBlocked: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;
}
