import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  Get,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { CashRegisterStatus } from './enums/cash-register-status.enum';

@Controller('cash-register')
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @UseGuards(JwtAuthGuard)
  @Post('open')
  open(@Body() dto: OpenCashRegisterDto, @GetUser() user: JwtPayload) {
    return this.cashRegisterService.open(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('close/:shopId')
  close(
    @Param('shopId') shopId: string,
    @Body() dto: CloseCashRegisterDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.cashRegisterService.close(shopId, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':cashRegisterId/movements')
  getMovements(
    @Param('cashRegisterId') cashRegisterId: string,
    @GetUser() user: JwtPayload,
  ) {
    return this.cashRegisterService.getMovements(cashRegisterId, user);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(PaginationInterceptor)
  @Get()
  getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('status') status?: CashRegisterStatus,
    @Query('employeeId') employeeId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('onlyOpen') onlyOpen?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cashRegisterService.getAll(
      {
        shopId,
        status,
        employeeId,
        fromDate,
        toDate,
        onlyOpen,
        page,
        limit,
      },
      user,
    );
  }

  // CAJA ABIERTA DEL USUARIO EN UNA TIENDA
  @UseGuards(JwtAuthGuard)
  @Get('current/:shopId')
  getCurrentForUser(
    @Param('shopId') shopId: string,
    @GetUser() user: JwtPayload,
  ) {
    return this.cashRegisterService.getCurrentForUser(shopId, user.id);
  }
}
