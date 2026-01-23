import { IsEnum } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['BASIC', 'PRO'])
  plan: 'BASIC' | 'PRO';
}
