import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { UserRole } from '@/auth/entities/user.entity';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
@Controller('payment-method')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(@GetUser() user: JwtPayload, @Body() dto: CreatePaymentMethodDto) {
    return this.paymentMethodService.createPaymentMethod(user, dto);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentMethodService.getAll(
      user,
      shopId,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(':id')
  async delete(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.paymentMethodService.delete(id, user);
  }
}
