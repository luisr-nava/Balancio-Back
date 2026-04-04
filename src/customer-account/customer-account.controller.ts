import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomerAccountService } from './customer-account.service';
import { PayCustomerAccountDto } from './dto/pay-customer-account.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('customer-account')
export class CustomerAccountController {
  constructor(private readonly service: CustomerAccountService) {}

  /** POST /customer-account/pay */
  @Post('pay')
  pay(@Body() dto: PayCustomerAccountDto, @Req() req: any) {
    return this.service.pay(dto, req.user);
  }

  /** GET /customer-account/debtors — must be before :customerId/:shopId */
  @Get('debtors')
  getDebtors(
    @Query('shopId') shopId: string,
    @Query('search') search?: string,
    @Query('minDebt') minDebt?: string,
    @Query('maxDebt') maxDebt?: string,
    @Query('isBlocked') isBlocked?: string,
    @Query('debtStatus') debtStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!shopId) {
      throw new BadRequestException('shopId es requerido');
    }
    const normalizedSearch = search?.trim() || undefined;
    const safePage = Math.max(1, Number(page ?? 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit ?? 20)));
    const parsedMinDebt =
      minDebt && !isNaN(Number(minDebt)) ? Number(minDebt) : undefined;
    const parsedMaxDebt =
      maxDebt && !isNaN(Number(maxDebt)) ? Number(maxDebt) : undefined;
    const parsedDebtStatus =
      debtStatus === 'pending' || debtStatus === 'paid'
        ? debtStatus
        : undefined;

    return this.service.getDebtors({
      shopId,
      search: normalizedSearch,
      minDebt: parsedMinDebt,
      maxDebt: parsedMaxDebt,
      isBlocked: isBlocked !== undefined ? isBlocked === 'true' : undefined,
      debtStatus: parsedDebtStatus,
      page: safePage,
      limit: safeLimit,
    });
  }

  /** GET /customer-account/movements — must be before :customerId/:shopId */
  @Get('movements')
  getMovements(
    @Query('shopId') shopId: string,
    @Query('customerId') customerId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!shopId) {
      throw new BadRequestException('shopId es requerido');
    }
    return this.service.getMovements({
      shopId,
      customerId: customerId || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      page: Math.max(1, Number(page ?? 1)),
      limit: Math.min(100, Math.max(1, Number(limit ?? 20))),
    });
  }

  /** PATCH /customer-account/:customerId/:shopId/block */
  @Patch(':customerId/:shopId/block')
  blockCustomer(
    @Param('customerId') customerId: string,
    @Param('shopId') shopId: string,
  ) {
    return this.service.blockCustomer(customerId, shopId);
  }

  /** PATCH /customer-account/:customerId/:shopId/unblock */
  @Patch(':customerId/:shopId/unblock')
  unblockCustomer(
    @Param('customerId') customerId: string,
    @Param('shopId') shopId: string,
  ) {
    return this.service.unblockCustomer(customerId, shopId);
  }

  /** GET /customer-account/:customerId/:shopId */
  @Get(':customerId/:shopId')
  getStatement(
    @Param('customerId') customerId: string,
    @Param('shopId') shopId: string,
  ) {
    return this.service.getStatement(customerId, shopId);
  }
}
