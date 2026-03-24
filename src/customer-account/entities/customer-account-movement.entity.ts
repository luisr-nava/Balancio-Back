import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Customer } from '@/customer/entities/customer.entity';
import { Shop } from '@/shop/entities/shop.entity';

export enum CustomerAccountMovementType {
  DEBT = 'DEBT',
  PAYMENT = 'PAYMENT',
}

@Entity('customer_account_movements')
@Index(['customerId', 'shopId'])
@Index(['createdAt'])
export class CustomerAccountMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @Column({ type: 'enum', enum: CustomerAccountMovementType })
  type: CustomerAccountMovementType;

  @Column('float')
  amount: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  /** saleId for DEBT movements, null for PAYMENT movements */
  @Column({ type: 'uuid', nullable: true })
  referenceId?: string | null;

  /** userId of the employee who created this movement */
  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopId' })
  shop: Shop;
}
