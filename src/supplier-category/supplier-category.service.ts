import { Injectable } from '@nestjs/common';
import { CreateSupplierCategoryDto } from './dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from './dto/update-supplier-category.dto';

@Injectable()
export class SupplierCategoryService {
  create(createSupplierCategoryDto: CreateSupplierCategoryDto) {
    return 'This action adds a new supplierCategory';
  }

  findAll() {
    return `This action returns all supplierCategory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} supplierCategory`;
  }

  update(id: number, updateSupplierCategoryDto: UpdateSupplierCategoryDto) {
    return `This action updates a #${id} supplierCategory`;
  }

  remove(id: number) {
    return `This action removes a #${id} supplierCategory`;
  }
}
