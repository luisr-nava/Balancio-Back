import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { ShopMeasurementUnit } from '@/measurement-unit/entities/shop-measurement-unit.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedRunner } from '.';
import { MeasurementUnitsSeed } from './measurement-units.seed';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { PaymentMethodsSeed } from './payment-methods.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeasurementUnit,
      ShopMeasurementUnit,
      PaymentMethod,
    ]),
  ],
  providers: [MeasurementUnitsSeed, PaymentMethodsSeed, SeedRunner],
  exports: [SeedRunner],
})
export class SeedModule {}
