import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { ShopMeasurementUnit } from '@/measurement-unit/entities/shop-measurement-unit.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedRunner } from '.';
import { MeasurementUnitsSeed } from './measurement-units.seed';

@Module({
  imports: [TypeOrmModule.forFeature([MeasurementUnit, ShopMeasurementUnit])],
  providers: [MeasurementUnitsSeed, SeedRunner],
  exports: [SeedRunner],
})
export class SeedModule {}
