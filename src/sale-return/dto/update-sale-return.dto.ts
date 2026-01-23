import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleReturnDto } from './create-sale-return.dto';

export class UpdateSaleReturnDto extends PartialType(CreateSaleReturnDto) {}
