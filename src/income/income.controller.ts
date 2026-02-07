import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';

@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateIncomeDto, @GetUser() user: JwtPayload) {
    return this.incomeService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(PaginationInterceptor)
  @Get()
  getAll(
    @GetUser() user: JwtPayload,
    @Query('shopId') shopId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.incomeService.getAll(
      { shopId, fromDate, toDate, category, page, limit },
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncomeDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.incomeService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.incomeService.remove(id, user);
  }
}
