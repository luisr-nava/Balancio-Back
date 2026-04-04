import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User } from '@/auth/entities/user.entity';
import { ShopAccessService } from './shop-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserShop, User])],
  providers: [ShopAccessService],
  exports: [ShopAccessService],
})
export class ShopAccessModule {}
