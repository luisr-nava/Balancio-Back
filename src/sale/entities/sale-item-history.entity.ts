import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Sale } from './sale.entity';

@Entity()
@Index(['saleId'])
export class SaleItemHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column()
  shopProductId: string;

  @Column()
  previousQty: number;

  @Column()
  newQty: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'text', nullable: true })
  changedBy?: string | null;

  @ManyToOne(() => Sale, { onDelete: 'CASCADE' })
  sale: Sale;
}
