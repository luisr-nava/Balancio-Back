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
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @GetUser() user: JwtPayload,
    @Body() createPurchaseDto: CreatePurchaseDto,
  ) {
    return this.purchaseService.createPurchase(createPurchaseDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(PaginationInterceptor)
  @Get()
  getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.purchaseService.getAll(
      {
        shopId,
        fromDate,
        toDate,
        page: Number(page ?? 1),
        limit: Number(limit ?? 20),
      },
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.purchaseService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelPurchaseDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.purchaseService.cancelPurchase(id, dto, user);
  }
}
