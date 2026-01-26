import { ConflictException, Injectable } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Repository } from 'typeorm';
import { ShopService } from '@/shop/shop.service';
import { JwtPayload } from 'jsonwebtoken';
import { SupplierShop } from './entities/supplier-shop.entity';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierShop)
    private readonly supplierShopRepository: Repository<SupplierShop>,
  ) {}

  async create(createSupplierDto: CreateSupplierDto, user: JwtPayload) {
    const exists = await this.supplierRepository.findOneBy({
      name: createSupplierDto.name,
      ownerId: user.ownerId || user.id,
    });
    if (exists) {
      throw new ConflictException(
        `El proveedor con el nombre ${createSupplierDto.name} ya existe`,
      );
    }

    const supplier = this.supplierRepository.create({
      name: createSupplierDto.name,
      ownerId: user.ownerId || user.id,
      category: createSupplierDto.categoryId
        ? { id: createSupplierDto.categoryId }
        : null,
      contactName: createSupplierDto.contactName,
      phone: createSupplierDto.phone,
      email: createSupplierDto.email,
      address: createSupplierDto.address,
      notes: createSupplierDto.notes,
      isActive: createSupplierDto.isActive ?? true,
    });
    await this.supplierRepository.save(supplier);

    const supplierShops = createSupplierDto.shopIds.map((shopId) =>
      this.supplierShopRepository.create({
        supplier: { id: supplier.id },
        shop: { id: shopId },
      }),
    );

    await this.supplierShopRepository.save(supplierShops);

    return {
      message: 'Proveedor creado exitosamente',
      supplier,
    };
  }
  async getAll(shopId: string, user: JwtPayload, page = 1, limit = 20) {
    const ownerId = user.ownerId ?? user.id;

    const [suppliers, total] = await this.supplierRepository.findAndCount({
      where: {
        ownerId,
        supplierShop: {
          shop: {
            id: shopId,
          },
        },
      },
      relations: {
        category: true,
        supplierShop: {
          shop: true,
        },
      },
      select: {
        id: true,
        name: true,
        contactName: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
        category: {
          name: true,
        },
        supplierShop: {
          id: true,
          shop: {
            id: true,
            name: true,
          },
        },
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        phone: supplier.phone,
        email: supplier.email,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt,
        category: supplier.category?.name ?? null,
        shops: supplier.supplierShop.map((ss) => ({
          id: ss.shop.id,
          name: ss.shop.name,
        })),
      })),
      total,
      page,
      limit,
    };
  }

  async update(
    supplierId: string,
    updateSupplierDto: UpdateSupplierDto,
    user: JwtPayload,
  ) {
    const ownerId = user.ownerId ?? user.id;

    const supplier = await this.supplierRepository.findOne({
      where: { id: supplierId, ownerId },
      relations: {
        supplierShop: true,
      },
    });

    if (!supplier) {
      throw new ConflictException('El proveedor no existe');
    }

    // 🔹 Validar nombre duplicado (si cambia)
    if (updateSupplierDto.name && updateSupplierDto.name !== supplier.name) {
      const exists = await this.supplierRepository.findOneBy({
        name: updateSupplierDto.name,
        ownerId,
      });

      if (exists) {
        throw new ConflictException(
          `Ya existe un proveedor con el nombre ${updateSupplierDto.name}`,
        );
      }
    }

    // 🔹 Update campos simples
    Object.assign(supplier, {
      name: updateSupplierDto.name ?? supplier.name,
      contactName: updateSupplierDto.contactName ?? supplier.contactName,
      phone: updateSupplierDto.phone ?? supplier.phone,
      email: updateSupplierDto.email ?? supplier.email,
      address: updateSupplierDto.address ?? supplier.address,
      notes: updateSupplierDto.notes ?? supplier.notes,
      isActive: updateSupplierDto.isActive ?? supplier.isActive,
      category:
        updateSupplierDto.categoryId !== undefined
          ? updateSupplierDto.categoryId
            ? { id: updateSupplierDto.categoryId }
            : null
          : supplier.category,
    });

    await this.supplierRepository.save(supplier);

    // 🔹 Update shops (solo si vienen)
    if (updateSupplierDto.shopIds) {
      // borrar relaciones actuales
      await this.supplierShopRepository.delete({
        supplier: { id: supplier.id },
      });

      // crear nuevas
      const supplierShops = updateSupplierDto.shopIds.map((shopId) =>
        this.supplierShopRepository.create({
          supplier: { id: supplier.id },
          shop: { id: shopId },
        }),
      );

      await this.supplierShopRepository.save(supplierShops);
    }

    return {
      message: 'Proveedor actualizado correctamente',
    };
  }

  async softDelete(supplierId: string, user: JwtPayload) {
    const ownerId = user.ownerId ?? user.id;

    const supplier = await this.supplierRepository.findOneBy({
      id: supplierId,
      ownerId,
    });

    if (!supplier) {
      throw new ConflictException('El proveedor no existe');
    }

    supplier.isActive = false;

    await this.supplierRepository.save(supplier);

    return {
      message: 'Proveedor eliminado correctamente',
    };
  }
}
