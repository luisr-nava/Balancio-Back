import { Injectable } from '@nestjs/common';
import { MeasurementUnitsSeed } from './measurement-units.seed';
import { PaymentMethodsSeed } from './payment-methods.seed';

@Injectable()
export class SeedRunner {
  constructor(
    private readonly measurementUnitsSeed: MeasurementUnitsSeed,
    private readonly paymentMethodsSeed: PaymentMethodsSeed,
  ) {}

  async run() {
    await this.measurementUnitsSeed.run();
    await this.paymentMethodsSeed.run();
  }
}
