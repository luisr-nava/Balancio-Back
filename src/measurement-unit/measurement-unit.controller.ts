import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MeasurementUnitService } from './measurement-unit.service';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';

@Controller('measurement-unit')
export class MeasurementUnitController {
  constructor(private readonly measurementUnitService: MeasurementUnitService) {}

  @Post()
  create(@Body() createMeasurementUnitDto: CreateMeasurementUnitDto) {
    return this.measurementUnitService.create(createMeasurementUnitDto);
  }

  @Get()
  findAll() {
    return this.measurementUnitService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.measurementUnitService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMeasurementUnitDto: UpdateMeasurementUnitDto) {
    return this.measurementUnitService.update(+id, updateMeasurementUnitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.measurementUnitService.remove(+id);
  }
}
