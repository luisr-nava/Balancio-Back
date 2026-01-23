import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierCategoryDto } from './create-supplier-category.dto';

export class UpdateSupplierCategoryDto extends PartialType(CreateSupplierCategoryDto) {}
