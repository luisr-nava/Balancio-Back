import { ConflictException, Injectable } from '@nestjs/common';
import { CreateSupplierCategoryDto } from './dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from './dto/update-supplier-category.dto';
import { JwtPayload } from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { SupplierCategory } from './entities/supplier-category.entity';
import { Repository } from 'typeorm';
import { ShopService } from '@/shop/shop.service';

@Injectable()
export class SupplierCategoryService {
  constructor(
    @InjectRepository(SupplierCategory)
    private readonly supplierCategoryRepository: Repository<SupplierCategory>,
    private readonly shopAccessService: ShopService,
  ) {}
  async create(dto: CreateSupplierCategoryDto, user: JwtPayload) {
    const existingCategory = await this.supplierCategoryRepository.findOne({
      where: { name: dto.name, shopId: dto.shopId },
    });
    if (existingCategory) {
      throw new ConflictException(
        `Ya existe una categoría llamada ${existingCategory.name} de proveedor con nombre en la tienda`,
      );
    }

    await this.shopAccessService.assertCanAccessShop(dto.shopId, user);
    const category = this.supplierCategoryRepository.create({
      name: dto.name,
      shopId: dto.shopId,
      createdBy: user.id,
    });

    const savedCategory = await this.supplierCategoryRepository.save(category);
    return {
      message: 'Categoría de proveedor creada exitosamente',
      category: savedCategory,
    };
  }

  async update(id: string, dto: UpdateSupplierCategoryDto) {
    const category = await this.supplierCategoryRepository.findOneBy({ id });
    const existingCategory = await this.supplierCategoryRepository.findOne({
      where: { name: dto.name, shopId: dto.shopId },
    });
    if (existingCategory) {
      return {
        message: `Ya existe una categoría llamada ${existingCategory.name} de proveedor con nombre en la tienda`,
      };
    }
    if (!category) {
      return { message: 'Categoría de proveedor no encontrada' };
    }
    Object.assign(category, dto);
    const updatedCategory =
      await this.supplierCategoryRepository.save(category);

    return {
      message: 'Categoría de proveedor actualizada exitosamente',
      category: updatedCategory,
    };
  }

  async getAll(shopId: string, page = 1, limit = 20) {
    const [category, total] =
      await this.supplierCategoryRepository.findAndCount({
        where: { shopId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    return {
      data: category,
      total,
    };
  }

  async softDelete(id: string) {
    await this.supplierCategoryRepository.update({ id }, { isActive: false });
    return {
      message: 'Categoría de proveedor eliminada exitosamente',
    };
  }
}
