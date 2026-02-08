import { IsString, MinLength } from 'class-validator';

export class CancelPurchaseDto {
  @IsString()
  @MinLength(5)
  reason: string;
}
