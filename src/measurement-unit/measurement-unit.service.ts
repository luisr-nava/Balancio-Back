import { Injectable } from '@nestjs/common';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';

@Injectable()
export class MeasurementUnitService {
  create(createMeasurementUnitDto: CreateMeasurementUnitDto) {
    return 'This action adds a new measurementUnit';
  }

  findAll() {
    return `This action returns all measurementUnit`;
  }

  findOne(id: number) {
    return `This action returns a #${id} measurementUnit`;
  }

  update(id: number, updateMeasurementUnitDto: UpdateMeasurementUnitDto) {
    return `This action updates a #${id} measurementUnit`;
  }

  remove(id: number) {
    return `This action removes a #${id} measurementUnit`;
  }
}
