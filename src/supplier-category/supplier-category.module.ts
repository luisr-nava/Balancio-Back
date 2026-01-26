import { Module } from '@nestjs/common';
import { SupplierCategoryService } from './supplier-category.service';
import { SupplierCategoryController } from './supplier-category.controller';
import { ShopModule } from '@/shop/shop.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierCategory } from './entities/supplier-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierCategory]), ShopModule],
  controllers: [SupplierCategoryController],
  providers: [SupplierCategoryService],
})
export class SupplierCategoryModule {}
