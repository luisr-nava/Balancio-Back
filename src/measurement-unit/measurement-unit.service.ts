import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMeasurementUnitDto } from './dto/create-measurement-unit.dto';
import { UpdateMeasurementUnitDto } from './dto/update-measurement-unit.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MeasurementBaseUnit,
  MeasurementUnit,
  MeasurementUnitCategory,
} from './entities/measurement-unit.entity';
import { JwtPayload } from 'jsonwebtoken';
import { In, Repository } from 'typeorm';
import { ShopMeasurementUnit } from './entities/shop-measurement-unit.entity';

@Injectable()
export class MeasurementUnitService {
  constructor(
    @InjectRepository(MeasurementUnit)
    private readonly measurementUnitRepository: Repository<MeasurementUnit>,
    @InjectRepository(ShopMeasurementUnit)
    private readonly shopMeasurementUnitRepository: Repository<ShopMeasurementUnit>,
  ) {}
  async create(dto: CreateMeasurementUnitDto, user: JwtPayload) {
    const code = (dto.code ?? dto.name).toUpperCase();

    const existingUnit = await this.measurementUnitRepository.findOne({
      where: { code },
    });

    if (existingUnit) {
      throw new ConflictException(`La unidad "${code}" ya existe`);
    }

    const unit = this.measurementUnitRepository.create({
      name: dto.name,
      code,
      category: dto.category ?? null,
      baseUnit: dto.baseUnit ?? null,
      isBaseUnit: dto.isBaseUnit ?? false,
      isDefault: dto.isDefault ?? false,
      createdByUserId: user.id,
    });

    const savedUnit = await this.measurementUnitRepository.save(unit);

    const relations = dto.shopIds.map((shopId) =>
      this.shopMeasurementUnitRepository.create({
        shopId,
        measurementUnitId: savedUnit.id,
        assignedByUserId: user.id,
      }),
    );

    await this.shopMeasurementUnitRepository.save(relations);

    return {
      message: 'Unidad de medida creada correctamente',
      measurementUnit: savedUnit,
    };
  }

  async getAll(shopId?: string, page = 1, limit = 20) {
    const [units, total] = await this.measurementUnitRepository.findAndCount({
      relations: {
        shopMeasurementUnits: {
          shop: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const filtered = shopId
      ? units.filter((unit) =>
          unit.shopMeasurementUnits.some((smu) => smu.shopId === shopId),
        )
      : units;

    const data = filtered.map((unit) => ({
      id: unit.id,
      name: unit.name,
      code: unit.code,
      category: unit.category,
      baseUnit: unit.baseUnit,
      isBaseUnit: unit.isBaseUnit,
      isDefault: unit.isDefault,
      createdAt: unit.createdAt,
      shops: unit.shopMeasurementUnits.map((smu) => ({
        id: smu.shopId,
        name: smu.shop?.name,
      })),
    }));

    return {
      data,
      total: filtered.length,
      page,
      limit,
    };
  }

  async update(id: string, dto: UpdateMeasurementUnitDto, user: JwtPayload) {
    const unit = await this.measurementUnitRepository.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: {
        shopMeasurementUnits: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unidad de medida no encontrada');
    }

    /** NAME **/
    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException(
          'El nombre de la unidad no puede estar vacío',
        );
      }

      if (dto.name !== unit.name) {
        const code = dto.name.toUpperCase();

        const exists = await this.measurementUnitRepository.findOne({
          where: { code },
        });

        if (exists && exists.id !== id) {
          throw new ConflictException(`La unidad "${code}" ya existe`);
        }

        unit.name = dto.name;
        unit.code = code;
      }
    }

    if (dto.category !== undefined) {
      unit.category = dto.category;
    }

    await this.measurementUnitRepository.save(unit);

    /** SHOPS **/
    const existingShopIds = unit.shopMeasurementUnits.map((smu) => smu.shopId);

    // si no viene shopIds → usar los actuales
    const incomingShopIds =
      dto.shopIds !== undefined ? dto.shopIds : existingShopIds;

    if (incomingShopIds.length === 0) {
      throw new BadRequestException(
        'La unidad debe estar asignada al menos a una tienda',
      );
    }

    const toAdd = incomingShopIds.filter(
      (shopId) => !existingShopIds.includes(shopId),
    );

    const toRemove = existingShopIds.filter(
      (shopId) => !incomingShopIds.includes(shopId),
    );

    if (toRemove.length) {
      await this.shopMeasurementUnitRepository.delete({
        measurementUnitId: id,
        shopId: In(toRemove),
      });
    }

    if (toAdd.length) {
      const relations = toAdd.map((shopId) =>
        this.shopMeasurementUnitRepository.create({
          shopId,
          measurementUnitId: id,
          assignedByUserId: user.id,
        }),
      );

      await this.shopMeasurementUnitRepository.save(relations);
    }

    return {
      message: 'Unidad de medida actualizada correctamente',
    };
  }

  async delete(id: string, user: JwtPayload) {
    const unit = await this.measurementUnitRepository.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: {
        products: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unidad de medida no encontrada');
    }

    if (unit.products.length > 0) {
      throw new ConflictException(
        'No se puede eliminar la unidad porque está asociada a uno o más productos',
      );
    }

    unit.isActive = false;
    unit.disabledAt = new Date();
    unit.disabledByUserId = user.id;

    await this.measurementUnitRepository.save(unit);

    return {
      message: 'Unidad de medida eliminada correctamente',
    };
  }
}
