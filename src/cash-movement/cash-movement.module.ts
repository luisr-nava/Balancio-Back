import { Module } from '@nestjs/common';
import { CashMovementService } from './cash-movement.service';
import { CashMovementController } from './cash-movement.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashMovement } from './entities/cash-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashMovement])],
  controllers: [CashMovementController],
  providers: [CashMovementService],
  exports: [CashMovementService],
})
export class CashMovementModule {}
