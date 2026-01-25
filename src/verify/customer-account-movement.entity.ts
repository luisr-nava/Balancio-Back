// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   Index,
//   Unique,
// } from 'typeorm';
// import { Customer } from '../src/customer/entities/customer.entity';
// import { CustomerPayment } from './customer-payment.entity';
// import { Sale } from '@/sale/entities/sale.entity';
// export enum AccountMovementType {
//   SALE = 'SALE',
//   PAYMENT = 'PAYMENT',
//   ADJUSTMENT = 'ADJUSTMENT',
// }
// @Entity()
// @Index(['customerId', 'createdAt'])
// @Index(['shopId', 'createdAt'])
// @Unique(['saleId'])
// @Unique(['paymentId'])
// export class CustomerAccountMovement {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;

//   @Column()
//   customerId: string;

//   @Column()
//   shopId: string;

//   // Tipo de movimiento
//   @Column({
//     type: 'enum',
//     enum: AccountMovementType,
//   })
//   type: AccountMovementType;

//   @Column('float')
//   amount: number;

//   // Saldo antes y después
//   @Column('float')
//   previousBalance: number;

//   @Column('float')
//   newBalance: number;

//   // Referencias
//   @Column({ type: 'text', nullable: true })
//   saleId?: string | null;

//   @Column({ type: 'text', nullable: true })
//   paymentId?: string | null;

//   // Detalles
//   @Column({ type: 'text', nullable: true })
//   description?: string | null;

//   // Fecha
//   @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//   createdAt: Date;

//   // Relaciones
//   @ManyToOne(() => Customer, (customer) => customer.accountMovements)
//   customer: Customer;

//   @ManyToOne(() => Sale, { nullable: true })
//   sale?: Sale | null;

//   @ManyToOne(() => CustomerPayment, { nullable: true })
//   payment?: CustomerPayment | null;
// }
