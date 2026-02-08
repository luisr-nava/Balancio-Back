import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
@Index(['shopId'])
@Index(['deletedAt'])
export class PurchaseDeletionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseId: string;

  @Column()
  shopId: string;

  @Column()
  shopName: string;

  @Column({ type: 'text', nullable: true })
  supplierId?: string | null;

  @Column({ type: 'text', nullable: true })
  supplierName?: string | null;

  @Column('float', { nullable: true })
  totalAmount?: number | null;

  @Column({ type: 'timestamp' })
  purchaseDate: Date;

  @Column({ type: 'text', nullable: true })
  originalNotes?: string | null;

  // Datos de la eliminación
  @Column()
  deletedByUserId: string;

  @Column()
  deletedByEmail: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  deletedAt: Date;

  @Column()
  deletionReason: string;

  // Snapshot JSON
  @Column({ type: 'jsonb' })
  itemsSnapshot: {
    items: {
      shopProductId: string;
      productName: string;
      quantity: number;
      unitCost: number;
      subtotal: number;
    }[];
    totals?: {
      totalAmount?: number | null;
    };
  };
}
