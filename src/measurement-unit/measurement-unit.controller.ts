import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { MeasurementUnitService } from './measurement-unit.service';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';

@Controller('measurement-unit')
export class MeasurementUnitController {
  constructor(
    private readonly measurementUnitService: MeasurementUnitService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createMeasurementUnitDto: CreateMeasurementUnitDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.measurementUnitService.create(createMeasurementUnitDto, user);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @GetUser() user: JwtPayload,
    @Param('shopId') shopId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.measurementUnitService.getAll(
      shopId,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMeasurementUnitDto: UpdateMeasurementUnitDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.measurementUnitService.update(
      id,
      updateMeasurementUnitDto,
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.measurementUnitService.delete(id, user);
  }
}
