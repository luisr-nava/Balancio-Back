import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketSettingsController } from './ticket-settings.controller';
import { TicketSettingsService } from './ticket-settings.service';
import { ShopTicketSettings } from './entities/shop-ticket-settings.entity';
import { ShopModule } from '@/shop/shop.module';
import { ReceiptModule } from './receipt/receipt.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopTicketSettings]),
    ShopModule,
    forwardRef(() => ReceiptModule),
  ],
  controllers: [TicketSettingsController],
  providers: [TicketSettingsService],
  exports: [TicketSettingsService, ReceiptModule],
})
export class TicketSettingsModule {}
