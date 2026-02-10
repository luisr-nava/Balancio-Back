import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Controller('sale')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@GetUser() user: JwtPayload, @Body() dto: CreateSaleDto) {
    return this.saleService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(PaginationInterceptor)
  @Get()
  getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('customerId') customerId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.saleService.getAll(
      {
        shopId,
        // customerId,
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
    @Body() dto: UpdateSaleDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.saleService.update(id, dto, user);
  }

  // ❌ Cancelar venta (no se borra, se anula)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelSaleDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.saleService.cancel(id, dto, user);
  }
}
