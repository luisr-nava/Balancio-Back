import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { CreditNote } from './credit-note.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';

@Entity()
export class CreditNoteApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  creditNoteId: string;

  @Column()
  purchaseId: string;

  @Column('float')
  amountApplied: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  applicationDate: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ManyToOne(() => CreditNote, (creditNote) => creditNote.applications)
  creditNote: CreditNote;

  @ManyToOne(() => Purchase)
  purchase: Purchase;
}
