import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductImportService } from './import/product-import.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ShopProduct } from './entities/shop-product.entity';
import { ProductHistory } from './entities/product-history.entity';
import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { Shop } from '@/shop/entities/shop.entity';
import { PurchaseItem } from '@/purchase/entities/purchase-item.entity';
import { PurchaseReturnItem } from '@/purchase-return/entities/purchase-return-item.entity';
import { ReplacementItem } from '@/purchase-return/entities/replacement-item.entity';
import { PromotionItem } from '@/promotion/entities/promotion-item.entity';
import { SaleItem } from '@/sale/entities/sale-item.entity';
import { RealtimeModule } from '@/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ShopProduct,
      ProductHistory,
      MeasurementUnit,
      Shop,
      PurchaseItem,
      PurchaseReturnItem,
      ReplacementItem,
      PromotionItem,
      SaleItem,
    ]),
    RealtimeModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, ProductImportService],
})
export class ProductModule {}
