import { Module } from '@nestjs/common';
import { SaleReturnService } from './sale-return.service';
import { SaleReturnController } from './sale-return.controller';

@Module({
  controllers: [SaleReturnController],
  providers: [SaleReturnService],
})
export class SaleReturnModule {}
