import { Module } from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { ShopModule } from '@/shop/shop.module';
import { CategoryProductShop } from './entities/product-category-shop.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductCategory, CategoryProductShop]),
    ShopModule,
  ],
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService],
})
export class ProductCategoryModule {}
