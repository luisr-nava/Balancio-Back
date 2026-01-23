import { Module } from '@nestjs/common';
import { MeasurementUnitService } from './measurement-unit.service';
import { MeasurementUnitController } from './measurement-unit.controller';

@Module({
  controllers: [MeasurementUnitController],
  providers: [MeasurementUnitService],
})
export class MeasurementUnitModule {}
