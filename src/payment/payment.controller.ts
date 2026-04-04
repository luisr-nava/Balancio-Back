import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { MercadoPagoWebhookDto } from './dto/mercadopago-webhook.dto';

@Controller('payment')
@UseGuards(ThrottlerGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post('webhook/mercadopago')
  async handleMercadoPagoWebhook(
    @Body() body: MercadoPagoWebhookDto,
    @Query('type') type: string,
  ) {
    if (type !== 'payment') {
      return { message: 'Evento ignorado' };
    }

    const providerPaymentId = body.data.id;

    return this.paymentService.processMercadoPagoWebhook(providerPaymentId);
  }
  @Post('finalize/:saleId')
  finalize(@Param('saleId') saleId: string) {
    return this.paymentService.finalizePaymentBySaleId(saleId);
  }
}
