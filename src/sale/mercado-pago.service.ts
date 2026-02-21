import { Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

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
    console.log(result);
    return {
      init_point: result.sandbox_init_point, // 👈 usamos sandbox
    };
  }

  // 👇 ESTO ES LO QUE FALTA
  async getPayment(paymentId: string) {
    console.log('MP TOKEN:', process.env.MP_ACCESS_TOKEN);

    const payment = new Payment(this.client);

    return payment.get({
      id: paymentId,
    });
  }
}
