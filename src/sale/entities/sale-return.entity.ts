// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   ManyToOne,
//   OneToMany,
// } from 'typeorm';
// import { Sale } from './sale.entity';
// import { SaleReturnItem } from './sale-return-item.entity';



// export enum RefundType {
//   CASH = 'CASH',
//   CREDIT = 'CREDIT',
//   EXCHANGE = 'EXCHANGE',
// }

// @Entity()
// export class SaleReturn {
//   @PrimaryGeneratedColumn('uuid')
//   id: string;

//   @Column()
//   saleId: string;

//   @Column({ type: 'enum', enum: SaleReturnStatus })
//   status: SaleReturnStatus;

//   @Column({ type: 'enum', enum: RefundType })
//   refundType: RefundType;

//   @Column({ nullable: true })
//   reason?: string;

//   @ManyToOne(() => Sale)
//   sale: Sale;

//   @OneToMany(() => SaleReturnItem, (item) => item.saleReturn)
//   items: SaleReturnItem[];

//   @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//   createdAt: Date;
// }
