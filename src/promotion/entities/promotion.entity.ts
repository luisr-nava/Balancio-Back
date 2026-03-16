import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { PromotionItem } from './promotion-item.entity';
import { PromotionBenefit } from './promotion-benefit.entity';

export enum PromotionType {
  DISCOUNT = 'DISCOUNT',
  COMBO = 'COMBO',
}

@Entity()
@Index(['shopId', 'isActive'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Shop)
  shop: Shop;

  @OneToMany(() => PromotionItem, (item) => item.promotion, {
    cascade: true,
    eager: true,
  })
  items: PromotionItem[];

  @OneToMany(() => PromotionBenefit, (b) => b.promotion, {
    cascade: true,
    eager: true,
  })
  benefits: PromotionBenefit[];
}
