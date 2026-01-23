import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '@/auth/entities/user.entity';
import { CashRegister } from '@/cash-register/entities/cash-register.entity';
import { ProductCategory } from '@/product-category/entities/product-category.entity';
import { SupplierCategory } from '@/supplier-category/entities/supplier-category.entity';
import { PurchaseReturn } from '@/purchase-return/entities/purchase-return.entity';
import { CreditNote } from '@/purchase-return/entities/credit-note.entity';
import { MerchandiseReplacement } from '@/purchase-return/entities/merchandise-replacement.entity';
import { Customer } from '@/customer/entities/customer.entity';
import { Expense } from '@/expense/entities/expense.entity';
import { Income } from '@/income/entities/income.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { SupplierShop } from '@/supplier/entities/supplier-shop.entity';
import { SaleReturn } from '@/sale/entities/sale-return.entity';
import { ShopMeasurementUnit } from '@/measurement-unit/entities/shop-measurement-unit.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { StockAlert } from '@/stock/entities/stock.entity';

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  // 🔐 OWNER
  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.ownedShops)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  projectId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: 'US' })
  countryCode: string;

  @Column({ default: 'USD' })
  currencyCode: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ type: 'int', nullable: true, default: 10 })
  lowStockThreshold?: number;

  // 🔗 RELACIONES
  // @OneToMany(() => UserShop, (us) => us.shop)
  // userShops: UserShop[];

  @OneToMany(() => Expense, (e) => e.shop)
  expenses: Expense[];

  @OneToMany(() => Income, (i) => i.shop)
  incomes: Income[];

  @OneToMany(() => Purchase, (p) => p.shop)
  purchases: Purchase[];

  @OneToMany(() => Sale, (s) => s.shop)
  sales: Sale[];

  @OneToMany(() => ShopProduct, (sp) => sp.shop)
  shopProducts: ShopProduct[];

  @OneToMany(() => SupplierShop, (ss) => ss.shop)
  supplierShop: SupplierShop[];

  @OneToMany(() => ProductCategory, (c) => c.shop)
  productCategories: ProductCategory[];

  @OneToMany(() => SupplierCategory, (sc) => sc.shop)
  supplierCategories: SupplierCategory[];

  @OneToMany(() => SaleReturn, (sr) => sr.shop)
  saleReturns: SaleReturn[];

  @OneToMany(() => PurchaseReturn, (pr) => pr.shop)
  purchaseReturns: PurchaseReturn[];

  @OneToMany(() => CreditNote, (cn) => cn.shop)
  creditNotes: CreditNote[];

  @OneToMany(() => MerchandiseReplacement, (mr) => mr.shop)
  merchandiseReplacements: MerchandiseReplacement[];

  @OneToMany(() => Customer, (c) => c.shop)
  customers: Customer[];

  @OneToMany(() => CashRegister, (cr) => cr.shop)
  cashRegisters: CashRegister[];

  @OneToMany(() => PaymentMethod, (pm) => pm.shop)
  paymentMethods: PaymentMethod[];

  @OneToMany(() => StockAlert, (sa) => sa.shop)
  stockAlerts: StockAlert[];

  @OneToMany(() => ShopMeasurementUnit, (mu) => mu.shop)
  measurementUnits: ShopMeasurementUnit[];

  @CreateDateColumn()
  createdAt: Date;
}
