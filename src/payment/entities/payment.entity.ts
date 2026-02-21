import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';

export enum PaymentProvider {
  CASH = 'CASH',
  CARD = 'CARD',
  MERCADOPAGO = 'MERCADOPAGO',
}

export enum PaymentsStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface MercadoPagoResponse {
  id: string;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  date_approved?: string;
}

@Entity('payments')
@Index(['saleId'], { unique: true }) // 🔒 una venta = un pago
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔗 RELACIONES

  @Column({ type: 'uuid' })
  saleId: string;

  @OneToOne(() => Sale)
  @JoinColumn({ name: 'saleId' })
  sale: Sale;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop)
  @JoinColumn({ name: 'shopId' })
  shop: Shop;

  @Column({ type: 'uuid' })
  cashRegisterId: string;

  @ManyToOne(() => CashRegister)
  @JoinColumn({ name: 'cashRegisterId' })
  cashRegister: CashRegister;

  // 💰 DATOS DEL PAGO

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
    default: PaymentProvider.MERCADOPAGO,
  })
  provider: PaymentProvider;

  @Column({ type: 'varchar', nullable: true, unique: true })
  providerPaymentId?: string; // id que devuelve MP

  @Column({ type: 'varchar', nullable: true })
  externalReference?: string; // normalmente saleId

  @Column({
    type: 'enum',
    enum: PaymentsStatus,
    default: PaymentsStatus.PENDING,
  })
  status: PaymentsStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'json', nullable: true })
  providerResponse?: MercadoPagoResponse | null;
}
