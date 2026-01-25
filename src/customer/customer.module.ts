import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { Customer } from './entities/customer.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]), ShopModule],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
