
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { SupplierShop } from './supplier-shop.entity';
import { SupplierCategory } from '@/supplier-category/entities/supplier-category.entity';
import { Product } from '@/product/entities/product.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { PurchaseReturn } from '@/purchase-return/entities/purchase-return.entity';
import { CreditNote } from '@/purchase-return/entities/credit-note.entity';
import { MerchandiseReplacement } from '@/purchase-return/entities/merchandise-replacement.entity';

@Entity()
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  ownerId: string;

  @Column({ type: 'text', nullable: true })
  contactName?: string | null;

  @Column({ type: 'text', nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  email?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => SupplierCategory, (category) => category.suppliers, {
    nullable: true,
  })
  category?: SupplierCategory | null;

  // Relaciones
  @OneToMany(() => Product, (product) => product.supplier)
  products: Product[];

  @OneToMany(() => Purchase, (purchase) => purchase.supplier)
  purchases: Purchase[];

  @OneToMany(() => SupplierShop, (ss) => ss.supplier)
  supplierShop: SupplierShop[];

  @OneToMany(() => PurchaseReturn, (pr) => pr.supplier)
  purchaseReturns: PurchaseReturn[];

  @OneToMany(() => CreditNote, (cn) => cn.supplier)
  creditNotes: CreditNote[];

  @OneToMany(() => MerchandiseReplacement, (mr) => mr.supplier)
  merchandiseReplacements: MerchandiseReplacement[];
}
