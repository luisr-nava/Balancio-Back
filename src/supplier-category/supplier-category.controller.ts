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
import { SupplierCategoryService } from './supplier-category.service';
import { CreateSupplierCategoryDto } from './dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from './dto/update-supplier-category.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { PaginationInterceptor } from '@/common/interceptors/pagination.interceptor';

@Controller('supplier-category')
export class SupplierCategoryController {
  constructor(
    private readonly supplierCategoryService: SupplierCategoryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createSupplierCategoryDto: CreateSupplierCategoryDto,
    @GetUser() user: JwtPayload,
  ) {
    return this.supplierCategoryService.create(createSupplierCategoryDto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierCategoryDto) {
    return this.supplierCategoryService.update(id, dto);
  }

  @UseInterceptors(PaginationInterceptor)
  @UseGuards(JwtAuthGuard)
  @Get()
  async getAll(
    @Param('shopId') shopId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supplierCategoryService.getAll(
      shopId,
      Number(page ?? 1),
      Number(limit ?? 20),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierCategoryService.softDelete(id);
  }
}
