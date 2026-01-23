import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  Index,
} from 'typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { MeasurementUnit } from './measurement-unit.entity';

@Entity()
@Unique(['shopId', 'measurementUnitId'])
@Index(['measurementUnitId'])
export class ShopMeasurementUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shopId: string;

  @Column()
  measurementUnitId: string;

  @Column({ type: 'text', nullable: true })
  assignedByUserId?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Shop, {
    onDelete: 'CASCADE',
  })
  shop: Shop;

  @ManyToOne(() => MeasurementUnit, {
    onDelete: 'CASCADE',
  })
  measurementUnit: MeasurementUnit;
}
