import { Module } from '@nestjs/common';
import { ReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';
import { SaleReceipt } from './entities/receipt.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketSettingsModule } from '@/ticket-settings/ticket-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleReceipt]),
    TicketSettingsModule,
  ],
  controllers: [ReceiptController],
  providers: [ReceiptService],
  exports: [ReceiptService],
})
export class ReceiptModule {}
