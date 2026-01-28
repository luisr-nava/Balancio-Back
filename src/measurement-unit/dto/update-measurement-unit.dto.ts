import { PartialType } from '@nestjs/mapped-types';
import { CreateMeasurementUnitDto } from './create-measurement-unit.dto';
import { MeasurementUnitCategory } from '../entities/measurement-unit.entity';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMeasurementUnitDto extends PartialType(CreateMeasurementUnitDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(MeasurementUnitCategory)
  category?: MeasurementUnitCategory;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsUUID('all', { each: true })
  shopIds?: string[];
}
