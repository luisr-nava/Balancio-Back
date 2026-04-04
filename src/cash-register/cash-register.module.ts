import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterGateway } from './cash-register.gateway';
import { CashRegisterListener } from './cash-register.listener';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegister } from './entities/cash-register.entity';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { ShopModule } from '@/shop/shop.module';
import { NotificationModule } from '@/notification/notification.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User } from '@/auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashRegister, CashMovement, UserShop, User]),
    CashMovementModule,
    ShopModule,
    NotificationModule,
    RealtimeModule,
  ],
  controllers: [CashRegisterController],
  providers: [CashRegisterService, CashRegisterGateway, CashRegisterListener],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
