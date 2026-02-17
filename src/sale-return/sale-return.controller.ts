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
import { SaleReturnService } from './sale-return.service';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { UpdateSaleReturnDto } from './dto/update-sale-return.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';

@Controller('sale-return')
export class SaleReturnController {
  constructor(private readonly saleReturnService: SaleReturnService) {}

  // @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() createSaleReturnDto: CreateSaleReturnDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.saleReturnService.create(createSaleReturnDto, user.id);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.saleReturnService.getAll(
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
}
