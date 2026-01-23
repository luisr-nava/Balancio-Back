import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { Shop } from '@/shop/entities/shop.entity';

@Entity()
@Unique(['supplierId', 'shopId'])
export class SupplierShop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  supplierId: string;

  @Column()
  shopId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.supplierShop)
  supplier: Supplier;

  @ManyToOne(() => Shop)
  shop: Shop;
}
