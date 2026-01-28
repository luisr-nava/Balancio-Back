import { MeasurementUnit } from '@/measurement-unit/entities/measurement-unit.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// src/database/seeds/measurement-units.seed.ts
@Injectable()
export class MeasurementUnitsSeed {
  constructor(
    @InjectRepository(MeasurementUnit)
    private readonly measurementUnitRepository: Repository<MeasurementUnit>,
  ) {}

  async run() {
    const defaults = [
      { name: 'Unidad', code: 'UNIT', isBaseUnit: true, isDefault: true },
      { name: 'Kilogramo', code: 'KG', isBaseUnit: true, isDefault: true },
      { name: 'Litro', code: 'L', isBaseUnit: true, isDefault: true },
    ];

    const created: string[] = [];

    for (const unit of defaults) {
      const exists = await this.measurementUnitRepository.findOne({
        where: { code: unit.code },
      });

      if (!exists) {
        await this.measurementUnitRepository.save(
          this.measurementUnitRepository.create(unit),
        );
        created.push(unit.code);
      }
    }

    if (created.length) {
      console.log(
        `[SEED] MeasurementUnits creadas correctamente: ${created.join(', ')}`,
      );
    } else {
      console.log('[SEED] MeasurementUnits ya existentes, nada para crear');
    }
  }
}
