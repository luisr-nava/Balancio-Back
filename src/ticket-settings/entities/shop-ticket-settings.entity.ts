import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { ReceiptPaperSize } from '../receipt/types/receipt.types';

export type CustomField = {
  label: string;
  value: string;
};

export type ItemLayoutMode = 'two-lines' | 'single-line';

export type TicketLayout = {
  items?: {
    mode?: ItemLayoutMode;
    showUnitPrice?: boolean;
  };
};

@Entity('shop_ticket_settings')
@Unique(['shopId'])
export class ShopTicketSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  shopId: string;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  shop: Shop;

  @Column({ type: 'varchar', nullable: true })
  businessName?: string;

  @Column({ type: 'varchar', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: true })
  showPhone: boolean;

  @Column({ type: 'varchar', nullable: true })
  email?: string;

  @Column({ type: 'boolean', default: true })
  showEmail: boolean;

  @Column({ type: 'varchar', nullable: true })
  website?: string;

  @Column({ type: 'boolean', default: true })
  showWebsite: boolean;

  @Column({ type: 'varchar', nullable: true })
  taxId?: string;

  @Column({ type: 'varchar', nullable: true })
  footerMessage?: string;

  @Column({ type: 'jsonb', default: [] })
  customFields: CustomField[];

  @Column({
    type: 'enum',
    enum: ReceiptPaperSize,
    enumName: 'receipt_paper_size',
    nullable: true,
  })
  paperSize?: ReceiptPaperSize;

  @Column({ type: 'jsonb', nullable: true })
  layout?: TicketLayout;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
