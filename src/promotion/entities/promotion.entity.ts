import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromotionItem } from './promotion-item.entity';
import { PromotionBenefit } from './promotion-benefit.entity';
import { PromotionShop } from './promotion-shop.entity';

export enum PromotionType {
  DISCOUNT = 'DISCOUNT',
  COMBO = 'COMBO',
}

export enum PromotionScopeType {
  ALL = 'ALL',
  SPECIFIC = 'SPECIFIC',
}

@Entity()
@Index(['isActive'])
@Index(['scopeType', 'isActive'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({
    type: 'enum',
    enum: PromotionScopeType,
    default: PromotionScopeType.SPECIFIC,
  })
  scopeType: PromotionScopeType;

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

  @OneToMany(() => PromotionShop, (ps) => ps.promotion, {
    cascade: true,
    eager: false,
  })
  shops: PromotionShop[];

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
