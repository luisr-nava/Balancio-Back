import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PromotionType } from '../entities/promotion.entity';
import { BenefitType } from '../entities/promotion-benefit.entity';

export class CreatePromotionItemDto {
  @IsUUID()
  shopProductId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreatePromotionBenefitDto {
  @IsEnum(BenefitType)
  type: BenefitType;

  /** Percentage (0-100), fixed price, or 0 for FREE_ITEM. */
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsUUID()
  freeProductId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  freeQuantity?: number;
}

export class CreatePromotionDto {
  @IsUUID()
  shopId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePromotionItemDto)
  items: CreatePromotionItemDto[];

  @ValidateNested()
  @Type(() => CreatePromotionBenefitDto)
  benefit: CreatePromotionBenefitDto;
}
