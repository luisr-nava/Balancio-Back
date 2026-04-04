import { Module } from '@nestjs/common';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { Income } from './entities/income.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegisterModule } from '@/cash-register/cash-register.module';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Income, UserShop]),
    CashRegisterModule,
    CashMovementModule,
    RealtimeModule,
    ShopModule,
  ],
  controllers: [IncomeController],
  providers: [IncomeService],
})
export class IncomeModule {}
