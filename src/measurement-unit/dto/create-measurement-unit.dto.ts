import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  MeasurementBaseUnit,
  MeasurementUnitCategory,
} from '../entities/measurement-unit.entity';
import { Transform } from 'class-transformer';

export class CreateMeasurementUnitDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(MeasurementUnitCategory)
  category?: MeasurementUnitCategory;

  @IsOptional()
  @IsEnum(MeasurementBaseUnit)
  baseUnit?: MeasurementBaseUnit;

  @IsOptional()
  @IsBoolean()
  isBaseUnit?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  shopIds: string[];
}
