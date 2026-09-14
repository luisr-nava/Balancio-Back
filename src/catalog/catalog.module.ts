import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from './entities/catalog.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CatalogRendererService } from './catalog-renderer.service';
import { ShopModule } from '@/shop/shop.module';
import { ProductModule } from '@/product/product.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Catalog]),
    ShopModule,
    ProductModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRendererService],
})
export class CatalogModule {}
