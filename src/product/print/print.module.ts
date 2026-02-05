import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintController } from './print.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopProduct } from '../entities/shop-product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShopProduct])],
  controllers: [PrintController],
  providers: [PrintService],
})
export class PrintModule {}
