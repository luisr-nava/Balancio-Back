import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketSettingsController } from './ticket-settings.controller';
import { TicketSettingsService } from './ticket-settings.service';
import { ShopTicketSettings } from './entities/shop-ticket-settings.entity';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopTicketSettings]),
    ShopModule,
  ],
  controllers: [TicketSettingsController],
  providers: [TicketSettingsService],
  exports: [TicketSettingsService],
})
export class TicketSettingsModule {}
