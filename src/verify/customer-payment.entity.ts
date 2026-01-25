// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   OneToOne,
//   Index,
// } from 'typeorm';
// import { Customer } from '../src/customer/entities/customer.entity';
// import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';

// @Entity()
// @Index(['customerId', 'paymentDate'])
// @Index(['paymentMethodId'])
// export class CustomerPayment {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;

//   @Column()
//   customerId: string;

//   @Column()
//   shopId: string;

//   @Column()
//   paymentMethodId: string;

//   // Monto
//   @Column('float')
//   amount: number;

//   // Referencia
//   @Column({ type: 'text', nullable: true })
//   referenceNumber?: string | null;

//   @Column({ type: 'text', nullable: true })
//   notes?: string | null;

//   // Fechas
//   @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//   paymentDate: Date;

//   @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//   createdAt: Date;

//   // Relaciones
//   // @ManyToOne(() => Customer, (customer) => customer.payments)
//   // customer: Customer;

//   @ManyToOne(() => PaymentMethod)
//   paymentMethod: PaymentMethod;

//   // @OneToOne(() => CustomerAccountMovement, (movement) => movement.payment)
//   // movement?: CustomerAccountMovement | null;
// }
