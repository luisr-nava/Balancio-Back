import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from './entities/promotion.entity';
import { PromotionItem } from './entities/promotion-item.entity';
import { PromotionBenefit } from './entities/promotion-benefit.entity';
import { PromotionShop } from './entities/promotion-shop.entity';
import { PromotionService } from './promotion.service';
import { PromotionController } from './promotion.controller';
import { PromotionListener } from './listeners/promotion.listener';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User } from '@/auth/entities/user.entity';
import { NotificationModule } from '@/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Promotion,
      PromotionItem,
      PromotionBenefit,
      PromotionShop,
      UserShop,
      User,
    ]),
    NotificationModule,
  ],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionListener],
  exports: [PromotionService],
})
export class PromotionModule {}
