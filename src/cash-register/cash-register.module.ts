import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegister } from './entities/cash-register.entity';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { ShopModule } from '@/shop/shop.module';
import { NotificationModule } from '@/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashRegister, CashMovement]),
    CashMovementModule,
    ShopModule,
    NotificationModule,
  ],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
