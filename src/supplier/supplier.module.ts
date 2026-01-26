import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { Supplier } from './entities/supplier.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopModule } from '@/shop/shop.module';
import { SupplierShop } from './entities/supplier-shop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, SupplierShop]), ShopModule],
  controllers: [SupplierController],
  providers: [SupplierService],
})
export class SupplierModule {}
