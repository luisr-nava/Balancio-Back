import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerAccountService } from './customer-account.service';
import { CustomerAccountController } from './customer-account.controller';
import { CustomerAccountMovement } from './entities/customer-account-movement.entity';
import { CustomerShop } from './entities/customer-shop.entity';
import { Customer } from '@/customer/entities/customer.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashRegisterModule } from '@/cash-register/cash-register.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerAccountMovement,
      CustomerShop,
      Customer,
      CashMovement,
    ]),
    CashRegisterModule,
  ],
  controllers: [CustomerAccountController],
  providers: [CustomerAccountService],
  exports: [CustomerAccountService],
})
export class CustomerAccountModule {}
