import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { PaymentMethod } from './payment-method.entity';

@Entity()
@Unique(['shopId', 'paymentMethodId'])
export class ShopPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  paymentMethodId: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @ManyToOne(() => PaymentMethod, { onDelete: 'CASCADE' })
  paymentMethod: PaymentMethod;
  @CreateDateColumn()
  createdAt: Date;
}
