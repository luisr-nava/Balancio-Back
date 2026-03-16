import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePromotionDto } from './create-promotion.dto';

export class UpdatePromotionDto extends PartialType(
  OmitType(CreatePromotionDto, ['shopId'] as const),
) {}
