import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { ReceiptPaperSize, ReceiptSnapshot } from '../types/receipt.types';

@Entity('sale_receipts')
export class SaleReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column()
  shopId: string;

  @Column({ type: 'jsonb' })
  snapshot: ReceiptSnapshot;

  @Column()
  receiptNumber: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: ReceiptPaperSize,
    default: ReceiptPaperSize.MM_80,
  })
  paperSize: ReceiptPaperSize;
}
