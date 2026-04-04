import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { BillingModule } from '@/billing/billing.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, UserShop]), BillingModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
