import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
} from 'typeorm';
import { Promotion } from './promotion.entity';

export enum BenefitType {
  PERCENT = 'PERCENT',
  FREE_ITEM = 'FREE_ITEM',
  FIXED_PRICE = 'FIXED_PRICE',
}

@Entity()
@Index(['promotionId'])
export class PromotionBenefit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  promotionId: string;

  @Column({ type: 'enum', enum: BenefitType })
  type: BenefitType;

  /**
   * Semantics by type:
   *   PERCENT     → discount percentage (0–100)
   *   FIXED_PRICE → total price for the combo (e.g., 500)
   *   FREE_ITEM   → ignored (use freeProductId + freeQuantity)
   */
  @Column('float', { default: 0 })
  value: number;

  /** For FREE_ITEM: which shopProductId is given for free. */
  @Column({ type: 'uuid', nullable: true })
  freeProductId: string | null;

  /** For FREE_ITEM: how many units are given for free. */
  @Column('float', { nullable: true })
  freeQuantity: number | null;

  @ManyToOne(() => Promotion, (p) => p.benefits, { onDelete: 'CASCADE' })
  promotion: Promotion;
}
