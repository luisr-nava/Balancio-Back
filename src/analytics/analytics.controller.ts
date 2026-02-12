import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(
    @Query('shopId') shopId: string,
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('date') date?: string,
  ) {
    return this.analyticsService.getShopDashboardAnalytics(
      shopId,
      period,
      date,
    );
  }
}
