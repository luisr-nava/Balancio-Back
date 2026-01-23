import { Module } from '@nestjs/common';
import { PurchaseReturnService } from './purchase-return.service';
import { PurchaseReturnController } from './purchase-return.controller';

@Module({
  controllers: [PurchaseReturnController],
  providers: [PurchaseReturnService],
})
export class PurchaseReturnModule {}
