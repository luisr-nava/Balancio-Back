import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { Customer } from './entities/customer.entity';
import { CustomerShop } from '@/customer-account/entities/customer-shop.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerShop, UserShop]),
    ShopModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
