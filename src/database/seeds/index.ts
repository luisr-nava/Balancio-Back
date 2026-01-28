import { Injectable } from '@nestjs/common';
import { MeasurementUnitsSeed } from './measurement-units.seed';

@Injectable()
export class SeedRunner {
  constructor(private readonly measurementUnitsSeed: MeasurementUnitsSeed) {}

  async run() {
    await this.measurementUnitsSeed.run();
    // futuro:
    // await this.categoriesSeed.run();
    // await this.rolesSeed.run();
  }
}
