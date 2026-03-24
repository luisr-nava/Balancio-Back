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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PromotionScopeType, PromotionType } from '../entities/promotion.entity';
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

  /** Percentage (0-100) or fixed price. Omit for FREE_ITEM. */
  @ValidateIf((o: CreatePromotionBenefitDto) => o.type !== BenefitType.FREE_ITEM)
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsUUID()
  freeProductId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  freeQuantity?: number;
}

export class CreatePromotionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsEnum(PromotionType)
  type: PromotionType;

  @IsEnum(PromotionScopeType)
  scopeType: PromotionScopeType;

  /**
   * Required when scopeType = SPECIFIC.
   * Must be UUIDs of shops the requesting user has access to.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shopIds?: string[];

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
