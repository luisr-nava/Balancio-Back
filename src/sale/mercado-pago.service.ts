import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import * as crypto from 'crypto';
import { envs } from '@/config';

@Injectable()
export class MercadoPagoService {
  private client: MercadoPagoConfig;

  constructor() {
    this.client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }
  async createPreference(saleId: string, title: string, amount: number) {
    const preference = new Preference(this.client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: saleId,
            title,
            quantity: 1,
            unit_price: amount,
          },
        ],
        external_reference: saleId,
        notification_url: `${process.env.API_URL}/sale/webhooks/mercadopago`,
      },
    });
    return {
      init_point: result.sandbox_init_point, // 👈 usamos sandbox
    };
  }

  validateWebhookSignature(dataId: string, xSignature: string): void {
    const secret = envs.mpWebhookSecret;
    if (!secret) {
      if (envs.nodeEnv === 'production') {
        throw new Error('MP_WEBHOOK_SECRET no está configurado en producción');
      }
      return;
    }

    if (!xSignature) {
      throw new UnauthorizedException('Firma de webhook no proporcionada');
    }

    const parts = xSignature.split(',');
    const ts = parts.find((p) => p.startsWith('ts='))?.split('=')?.[1];
    const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')?.[1];

    if (!ts?.trim() || !v1?.trim()) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    const tsSeconds = parseInt(ts, 10);
    if (isNaN(tsSeconds) || tsSeconds <= 0) {
      throw new UnauthorizedException('Firma de webhook rechazada');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - tsSeconds) > 300) {
      throw new UnauthorizedException('Firma de webhook expirada');
    }

    if (!/^[0-9a-f]{64}$/i.test(v1)) {
      throw new UnauthorizedException('Firma de webhook rechazada');
    }

    const template = `id:${dataId};request-date:${ts};`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(template)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1, 'hex');
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      throw new UnauthorizedException('Firma de webhook rechazada');
    }
  }

  async getPayment(paymentId: string) {
    const payment = new Payment(this.client);

    return payment.get({
      id: paymentId,
    });
  }
}
