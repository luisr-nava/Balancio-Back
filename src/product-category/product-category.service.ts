import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductCategory } from './entities/product-category.entity';
import { JwtPayload } from 'jsonwebtoken';
import { In, Not, Repository } from 'typeorm';
import { CategoryProductShop } from './entities/product-category-shop.entity';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepository: Repository<ProductCategory>,
    @InjectRepository(CategoryProductShop)
    private readonly categoryProductShopRepository: Repository<CategoryProductShop>,
  ) {}

  async create(dto: CreateProductCategoryDto, user: JwtPayload) {
    const existingCategory = await this.productCategoryRepository.findOne({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new ConflictException(`La categoría "${dto.name}" ya existe`);
    }

    const category = this.productCategoryRepository.create({
      name: dto.name,
      createdBy: user.id,
    });

    const savedCategory = await this.productCategoryRepository.save(category);

    const categoryProductShops = dto.shopIds.map((shopId) =>
      this.categoryProductShopRepository.create({
        categoryId: savedCategory.id,
        shopId,
      }),
    );

    await this.categoryProductShopRepository.save(categoryProductShops);

    return {
      message: 'Categoría creada correctamente',
      category: savedCategory,
    };
  }

  async getAll(shopId: string, user: JwtPayload, page = 1, limit = 20) {
    const [data, total] = await this.productCategoryRepository.findAndCount({
      where: {
        categoryProductShops: {
          shopId,
        },
      },
      relations: {
        categoryProductShops: {
          shop: true,
        },
        createdByUser: true,
        updatedByUser: true,
        disabledByUser: true,
      },
      skip: (page - 1) * limit,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    const transformed = data.map((category) => ({
      id: category.id,
      name: category.name,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      disabledAt: category.disabledAt,
      isActive: category.isActive,

      createdBy: category.createdByUser?.fullName,
      updatedBy: category.updatedByUser?.fullName,
      disabledBy: category.disabledByUser?.fullName,

      categoryProductShops: category.categoryProductShops.map((cps) => ({
        shopName: cps.shop?.name,
      })),
    }));

    return {
      data: transformed,
      total,
      page,
      limit,
    };
  }

  async update(id: string, dto: UpdateProductCategoryDto, user: JwtPayload) {
    const category = await this.productCategoryRepository.findOne({
      where: { id },
      relations: {
        categoryProductShops: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    const existingCategory = await this.productCategoryRepository.findOne({
      where: {
        name: dto.name,
        id: Not(id), // 👈 CLAVE
      },
    });

    if (existingCategory) {
      throw new ConflictException(`La categoría "${dto.name}" ya existe`);
    }

    category.name = dto.name;
    category.updatedBy = user.id;

    await this.productCategoryRepository.save(category);

    // sincronizar tiendas
    const existingShopIds = category.categoryProductShops.map(
      (cps) => cps.shopId,
    );

    const toAdd = dto.shopIds.filter(
      (shopId) => !existingShopIds.includes(shopId),
    );

    const toRemove = existingShopIds.filter(
      (shopId) => !dto.shopIds.includes(shopId),
    );

    if (toRemove.length) {
      await this.categoryProductShopRepository.delete({
        categoryId: id,
        shopId: In(toRemove),
      });
    }

    if (toAdd.length) {
      const relations = toAdd.map((shopId) =>
        this.categoryProductShopRepository.create({
          categoryId: id,
          shopId,
        }),
      );
      await this.categoryProductShopRepository.save(relations);
    }

    return {
      message: 'Categoría actualizada correctamente',
    };
  }

  async softDelete(id: string, user: JwtPayload) {
    const category = await this.productCategoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const now = new Date();

    // soft delete categoría
    await this.productCategoryRepository.update(
      { id },
      {
        isActive: false,
        disabledAt: now,
        disabledBy: user.id,
      },
    );

    // soft delete relaciones
    await this.categoryProductShopRepository.update(
      { categoryId: id },
      {
        isActive: false,
      },
    );

    return {
      message: 'Categoría eliminada correctamente',
    };
  }
}
