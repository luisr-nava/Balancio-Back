import { Module } from '@nestjs/common';
import { SupplierCategoryService } from './supplier-category.service';
import { SupplierCategoryController } from './supplier-category.controller';

@Module({
  controllers: [SupplierCategoryController],
  providers: [SupplierCategoryService],
})
export class SupplierCategoryModule {}
