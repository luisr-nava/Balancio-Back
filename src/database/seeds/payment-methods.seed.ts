import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';

@Injectable()
export class PaymentMethodsSeed {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async run() {
    const defaults: Partial<PaymentMethod>[] = [
      {
        name: 'Efectivo',
        code: 'CASH',
        description: 'Pago en efectivo',
        isSystem: true,
        requiresCustomer: false,
        createsCashMovement: true,
      },
      {
        name: 'Cuenta corriente',
        code: 'ACCOUNT',
        description: 'Pago a cuenta / fiado',
        isSystem: true,
        requiresCustomer: true,
        createsCashMovement: false,
      },
    ];

    const created: string[] = [];

    for (const method of defaults) {
      const exists = await this.paymentMethodRepository.findOne({
        where: { code: method.code },
      });

      if (!exists) {
        await this.paymentMethodRepository.save(
          this.paymentMethodRepository.create(method),
        );
        created.push(method.code!);
      }
    }

    if (created.length) {
      console.log(`[SEED] PaymentMethods creados: ${created.join(', ')}`);
    } else {
      console.log('[SEED] PaymentMethods ya existentes, nada para crear');
    }
  }
}
