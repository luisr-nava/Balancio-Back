import { PartialType } from '@nestjs/mapped-types';
import { CreateMeasurementUnitDto } from './create-measurement-unit.dto';

export class UpdateMeasurementUnitDto extends PartialType(CreateMeasurementUnitDto) {}
