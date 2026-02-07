import { Module } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { CashRegisterModule } from '@/cash-register/cash-register.module';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashMovementModule } from '@/cash-movement/cash-movement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense]),
    CashRegisterModule,
    CashMovementModule,
  ],
  controllers: [ExpenseController],
  providers: [ExpenseService],
})
export class ExpenseModule {}
