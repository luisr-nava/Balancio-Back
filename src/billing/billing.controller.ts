import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { UserRole } from '@/auth/entities/user.entity';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { RawBodyRequest } from './types/raw-body-request';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.OWNER)
  @Get('subscription')
  async getMySubscription(@GetUser() user: JwtPayload) {
    return this.billingService.getSubscriptionByOwner(user.id);
  }

  @Post('webhook')
  @HttpCode(200)
  handleStripeWebhook(@Req() req: RawBodyRequest) {
    return this.billingService.handleWebhook(req);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.OWNER)
  async createCheckout(
    @GetUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession(user.id, dto.plan);
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.OWNER)
  async changePlan(
    @GetUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto, // reutilizamos el dto (plan)
  ) {
    return this.billingService.requestPlanChange(user.id, dto.plan);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.OWNER)
  cancel(@GetUser() user: JwtPayload) {
    return this.billingService.cancelSubscription(user.id);
  }
}
