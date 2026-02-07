import { Module } from '@nestjs/common';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { Income } from './entities/income.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashRegisterModule } from '@/cash-register/cash-register.module';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Income]),
    CashRegisterModule,
    CashMovementModule,
  ],
  controllers: [IncomeController],
  providers: [IncomeService],
})
export class IncomeModule {}
