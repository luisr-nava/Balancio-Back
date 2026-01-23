import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Unique,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { CustomerAccountMovement } from './customer-account-movement.entity';
import { CustomerPayment } from './customer-payment.entity';
export enum AccountMovementType {
  SALE = 'SALE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity()
@Unique('Customer_shopId_dni_unique', ['shopId', 'dni'])
@Index(['shopId', 'isActive'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  // Datos personales
  @Column()
  fullName: string;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  dni?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  // Cuenta corriente
  @Column('float', { nullable: true })
  creditLimit?: number | null;

  @Column('float', { default: 0 })
  currentBalance: number;

  // Estado
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // Fechas
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // Relaciones
  @ManyToOne(() => Shop, (shop) => shop.customers)
  shop: Shop;

  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];

  @OneToMany(() => CustomerPayment, (payment) => payment.customer)
  payments: CustomerPayment[];

  @OneToMany(() => CustomerAccountMovement, (movement) => movement.customer)
  accountMovements: CustomerAccountMovement[];
}
