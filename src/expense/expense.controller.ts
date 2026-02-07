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
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';

@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createExpenseDto: CreateExpenseDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.expenseService.create(createExpenseDto, user);
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
    return this.expenseService.getAll(
      {
        shopId,
        fromDate,
        toDate,
        category,
        page,
        limit,
      },
      user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.expenseService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: JwtPayload) {
    return this.expenseService.remove(id, user);
  }
}
