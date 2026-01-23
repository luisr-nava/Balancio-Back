import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { CashRegister, CashRegisterExportFormat } from './cash-register.entity';

@Entity()
@Index(['cashRegisterId', 'format', 'expiresAt'])
export class CashRegisterExport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cashRegisterId: string;

  @Column({
    type: 'enum',
    enum: CashRegisterExportFormat,
  })
  format: CashRegisterExportFormat;

  @Column()
  url: string;

  @Column()
  contentType: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => CashRegister, (cr) => cr.exports)
  cashRegister: CashRegister;
}
