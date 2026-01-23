import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Sale, SaleHistoryAction } from './sale.entity';

@Entity()
@Index(['saleId'])
export class SaleHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column({
    type: 'enum',
    enum: SaleHistoryAction,
  })
  action: SaleHistoryAction;

  @Column({ type: 'json' })
  snapshot: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Sale)
  sale: Sale;
}
