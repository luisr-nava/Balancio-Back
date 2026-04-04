import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User } from '@/auth/entities/user.entity';
import { ShopService } from '@/shop/shop.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly shopService: ShopService,
  ) {}

  @Get('dashboard')
  async getDashboard(
    @GetUser() user: User,
    @Query('shopId') shopId: string,
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('date') date?: string,
  ) {
    if (!shopId) {
      this.logBlockedAccess(user, null, 'missing shopId');
      throw new BadRequestException('shopId es requerido');
    }

    try {
      await this.shopService.assertCanAccessShop(shopId, user);
    } catch (error) {
      this.logBlockedAccess(user, shopId, 'shop access denied');
      throw error;
    }

    return this.analyticsService.getShopDashboardAnalytics(
      shopId,
      user,
      period,
      date,
    );
  }

  private logBlockedAccess(
    user: User,
    shopId: string | null,
    reason: string,
  ): void {
    this.logger.warn(
      JSON.stringify({
        userId: user.id,
        role: user.role,
        shopId,
        saleId: null,
        reason,
      }),
    );
  }
}
