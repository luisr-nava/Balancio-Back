import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardVisibilityController } from './dashboard-visibility.controller';
import { DashboardVisibilityService } from './dashboard-visibility.service';
import { ShopDashboardVisibility } from './entities/shop-dashboard-visibility.entity';
import { ShopModule } from '@/shop/shop.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShopDashboardVisibility]),
    ShopModule,
  ],
  controllers: [DashboardVisibilityController],
  providers: [DashboardVisibilityService],
  exports: [DashboardVisibilityService],
})
export class DashboardVisibilityModule {}
