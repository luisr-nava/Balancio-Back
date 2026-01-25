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
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';

@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.customerService.create(createCustomerDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    shopId: string,
  ) {
    return this.customerService.update(id, updateCustomerDto, shopId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.softDelete(id);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(
    @GetUser() user: JwtPayload,
    @Param('shopId') shopId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customerService.getAll(
      shopId,
      user,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }
}
