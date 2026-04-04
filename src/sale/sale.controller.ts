import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseInterceptors,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { MercadoPagoService } from './mercado-pago.service';

@Controller('sale')
@UseGuards(ThrottlerGuard)
export class SaleController {
  constructor(
    private readonly saleService: SaleService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}
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
        customerId,
        fromDate,
        toDate,
        page: Number(page ?? 1),
        limit: Number(limit ?? 20),
      },
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getById(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.saleService.getById(id, user);
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

  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post('webhooks/mercadopago')
  async mercadoPagoWebhook(
    @Body() body: any,
    @Headers('x-signature') xSignature: string,
  ) {
    if (body.type !== 'payment') return { received: true };

    const paymentId = body.data?.id;
    if (!paymentId || typeof paymentId !== 'string') {
      throw new BadRequestException(
        'Payload inválido: data.id ausente o incorrecto',
      );
    }
    if (!xSignature) {
      throw new BadRequestException('Cabecera x-signature requerida');
    }

    this.mercadoPagoService.validateWebhookSignature(paymentId, xSignature);

    const mpPayment = await this.mercadoPagoService.getPayment(paymentId);

    if (mpPayment.status === 'approved') {
      const saleId = mpPayment.external_reference;

      await this.saleService.markSaleAsPaidFromWebhook(
        saleId!,
        mpPayment.transaction_amount,
      );
    }

    return { received: true };
  }
}
