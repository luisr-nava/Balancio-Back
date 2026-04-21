import { Module, forwardRef } from '@nestjs/common';
import { TicketReceiptService } from './receipt.service';
import { ReceiptController } from './receipt.controller';
import { SaleReceipt } from './entities/receipt.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { ShopModule } from '@/shop/shop.module';
import { TicketSettingsModule } from '@/ticket-settings/ticket-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SaleReceipt, Shop]),
    ShopModule,
    forwardRef(() => TicketSettingsModule),
  ],
  controllers: [ReceiptController],
  providers: [TicketReceiptService],
  exports: [TicketReceiptService],
})
export class ReceiptModule {}
