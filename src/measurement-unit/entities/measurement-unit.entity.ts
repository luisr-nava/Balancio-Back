export enum MeasurementUnitCategory {
  UNIT = 'UNIT',
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
}

export enum MeasurementBaseUnit {
  UNIT = 'UNIT',
  KG = 'KG',
  L = 'L',
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Unique,
} from 'typeorm';
import { ShopMeasurementUnit } from './shop-measurement-unit.entity';
import { Product } from '@/product/entities/product.entity';

@Entity()
@Unique(['code'])
export class MeasurementUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  code: string;

  @Column({
    type: 'enum',
    enum: MeasurementUnitCategory,
    nullable: true,
  })
  category?: MeasurementUnitCategory | null;

  @Column({
    type: 'enum',
    enum: MeasurementBaseUnit,
    nullable: true,
  })
  baseUnit?: MeasurementBaseUnit | null;

  @Column('decimal', { precision: 18, scale: 6, default: 1 })
  conversionFactor: string;

  @Column({ default: false })
  isBaseUnit: boolean;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ type: 'text', nullable: true })
  createdByUserId?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @OneToMany(() => ShopMeasurementUnit, (smu) => smu.measurementUnit)
  shopMeasurementUnits: ShopMeasurementUnit[];

  @OneToMany(() => Product, (product) => product.measurementUnit)
  products: Product[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  disabledByUserId?: string | null;
}
