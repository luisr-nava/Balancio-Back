import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum AnalyticsType {
  SALES = 'sales',
  PURCHASES = 'purchases',
  INCOMES = 'incomes',
  EXPENSES = 'expenses',
  ALL = 'all',
}

export enum AnalyticsPeriod {
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  RANGE = 'range',
}

export class AnalyticsQueryDto {
  @IsString()
  @IsNotEmpty()
  shopId!: string;

  @IsEnum(AnalyticsType)
  @IsOptional()
  type: AnalyticsType = AnalyticsType.ALL;

  @IsEnum(AnalyticsPeriod)
  @IsOptional()
  period: AnalyticsPeriod = AnalyticsPeriod.WEEK;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  @ValidateIf((o) => o.period === AnalyticsPeriod.RANGE)
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  from?: string;

  @ValidateIf((o) => o.period === AnalyticsPeriod.RANGE)
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  to?: string;
}
