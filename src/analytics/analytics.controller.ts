import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { AnalyticsResponse } from './interfaces/analytics-response.interface';
// TODO: 
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getAnalytics(
    @Query() query: AnalyticsQueryDto,
    @GetUser() user: JwtPayload,
  ): Promise<AnalyticsResponse> {
    return this.analyticsService.getAnalytics(query, user);
  }
}
