import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { DashboardVisibilityService } from './dashboard-visibility.service';
import { UpdateDashboardVisibilityDto } from './dto/update-dashboard-visibility.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User, UserRole } from '@/auth/entities/user.entity';
import { ShopService } from '@/shop/shop.service';

@Controller('dashboard-visibility')
@UseGuards(JwtAuthGuard)
export class DashboardVisibilityController {
  constructor(
    private readonly dashboardVisibilityService: DashboardVisibilityService,
    private readonly shopService: ShopService,
  ) {}

  @Get()
  async getVisibility(
    @GetUser() user: User,
    @Query('shopId') shopId: string,
  ) {
    await this.shopService.assertCanAccessShop(shopId, user);
    return this.dashboardVisibilityService.getVisibility(shopId);
  }

  @Patch()
  async updateVisibility(
    @GetUser() user: User,
    @Query('shopId') shopId: string,
    @Body() dto: UpdateDashboardVisibilityDto,
  ) {
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException('Solo el propietario puede modificar la configuración del dashboard');
    }
    await this.shopService.assertCanAccessShop(shopId, user);
    return this.dashboardVisibilityService.updateVisibility(shopId, dto as any);
  }
}
