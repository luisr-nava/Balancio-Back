import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { RealtimeModule } from '@/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, UserShop]),
    RealtimeModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
