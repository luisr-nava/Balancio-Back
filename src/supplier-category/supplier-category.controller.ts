import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SupplierCategoryService } from './supplier-category.service';
import { CreateSupplierCategoryDto } from './dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from './dto/update-supplier-category.dto';

@Controller('supplier-category')
export class SupplierCategoryController {
  constructor(private readonly supplierCategoryService: SupplierCategoryService) {}

  @Post()
  create(@Body() createSupplierCategoryDto: CreateSupplierCategoryDto) {
    return this.supplierCategoryService.create(createSupplierCategoryDto);
  }

  @Get()
  findAll() {
    return this.supplierCategoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierCategoryService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierCategoryDto: UpdateSupplierCategoryDto) {
    return this.supplierCategoryService.update(+id, updateSupplierCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierCategoryService.remove(+id);
  }
}
