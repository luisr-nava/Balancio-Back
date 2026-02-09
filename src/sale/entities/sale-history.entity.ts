import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Sale } from './sale.entity';

export enum SaleHistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  CANCELLED = 'CANCELLED',
}

@Entity()
export class SaleHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: SaleHistoryAction })
  action: SaleHistoryAction;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @ManyToOne(() => Sale)
  sale: Sale;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
