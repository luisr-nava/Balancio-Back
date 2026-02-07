import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { JwtPayload } from 'jsonwebtoken';
import { DataSource, In, Not, Repository } from 'typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Shop } from '@/shop/entities/shop.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { ShopPaymentMethod } from './entities/shop-payment-method.entity';
import { Sale } from '@/sale/entities/sale.entity';
import { Purchase } from '@/purchase/entities/purchase.entity';
import { Income } from '@/income/entities/income.entity';
import { Expense } from '@/expense/entities/expense.entity';

@Injectable()
export class PaymentMethodService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,

    @InjectRepository(ShopPaymentMethod)
    private readonly shopPaymentMethodRepository: Repository<ShopPaymentMethod>,

    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserShop)
    private readonly userShopRepository: Repository<UserShop>,

    @InjectRepository(Sale)
    private readonly saleRepository: Repository<Sale>,

    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,

    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,

    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async createPaymentMethod(user: JwtPayload, dto: CreatePaymentMethodDto) {
    if (user.role === 'EMPLOYEE') {
      throw new ForbiddenException('No puedes crear metodos de pago');
    }

    const code = dto.code.toUpperCase();
    const reserved = ['CASH', 'ACCOUNT'];

    if (reserved.includes(code)) {
      throw new BadRequestException(`El método ${code} es del sistema`);
    }

    // validar acceso a shops
    const shopCount = await this.shopRepository.count({
      where: {
        id: In(dto.shopIds),
        ownerId: user.id,
      },
    });

    if (shopCount !== dto.shopIds.length) {
      throw new ForbiddenException('No tienes acceso a una o más tiendas');
    }

    // validar unicidad global
    const exists = await this.paymentMethodRepository.findOne({
      where: { code },
    });

    if (exists) {
      throw new BadRequestException(
        `Ya existe un método de pago con código ${code}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ crear método global
      const paymentMethod = await manager.save(
        manager.create(PaymentMethod, {
          name: dto.name,
          code,
          description: dto.description,
          isSystem: false,
          requiresCustomer: false,
          createsCashMovement: true,
        }),
      );

      // 2️⃣ asociar a tiendas
      for (const shopId of dto.shopIds) {
        await manager.save(
          manager.create(ShopPaymentMethod, {
            shopId,
            paymentMethodId: paymentMethod.id,
            isActive: dto.isActive ?? true,
          }),
        );
      }

      return {
        message: 'Método de pago creado correctamente',
        data: {
          id: paymentMethod.id,
          name: paymentMethod.name,
          code: paymentMethod.code,
        },
      };
    });
  }

  async getAll(user: JwtPayload, shopId?: string, page = 1, limit = 20) {
    // 🔒 Normalización (evita totalPages null)
    page = Number(page) || 1;
    limit = Number(limit) || 20;

    // 1️⃣ Resolver tiendas accesibles
    let shopIds: string[];

    if (user.role === 'OWNER') {
      const shops = await this.shopRepository.find({
        where: { ownerId: user.id },
        select: ['id'],
      });
      shopIds = shops.map((s) => s.id);
    } else {
      const userShops = await this.userShopRepository.find({
        where: { userId: user.id },
        select: ['shopId'],
      });
      shopIds = userShops.map((us) => us.shopId);
    }

    if (shopId) {
      if (!shopIds.includes(shopId)) {
        throw new ForbiddenException('No tienes acceso a esta tienda');
      }
      shopIds = [shopId];
    }

    // 2️⃣ Métodos SYSTEM (seed)
    const systemMethods = await this.paymentMethodRepository.find({
      where: { isSystem: true },
      order: { code: 'ASC' },
    });

    // 3️⃣ Métodos asociados a tiendas (incluye los creados por el usuario)
    const shopMethods = await this.shopPaymentMethodRepository.find({
      where: { shopId: In(shopIds) },
      relations: { paymentMethod: true },
    });

    // 4️⃣ Agrupar ShopPaymentMethod por PaymentMethod
    const shopMethodMap = new Map<
      string,
      { shopId: string; isActive: boolean }[]
    >();

    for (const sm of shopMethods) {
      const list = shopMethodMap.get(sm.paymentMethod.id) ?? [];

      list.push({
        shopId: sm.shopId,
        isActive: sm.isActive,
      });

      shopMethodMap.set(sm.paymentMethod.id, list);
    }

    // 5️⃣ Métodos NO system creados por el usuario
    const userMethods = shopMethods
      .map((sm) => sm.paymentMethod)
      .filter((pm) => !pm.isSystem);

    // 6️⃣ Unir system + user y eliminar duplicados
    const allMethods = [...systemMethods, ...userMethods];

    const uniqueMethods = Array.from(
      new Map(allMethods.map((pm) => [pm.id, pm])).values(),
    );

    // 7️⃣ Traer nombres de tiendas (una sola query)
    const shops = await this.shopRepository.find({
      where: { id: In(shopIds) },
      select: ['id', 'name'],
    });

    const shopNameMap = new Map(shops.map((s) => [s.id, s.name]));

    // 8️⃣ Construir response final
    const data = uniqueMethods.map((pm) => {
      const shopConfigs = shopMethodMap.get(pm.id) ?? [];

      return {
        id: pm.id,
        name: pm.name,
        code: pm.code,
        description: pm.description,
        isSystem: pm.isSystem,
        requiresCustomer: pm.requiresCustomer,
        createsCashMovement: pm.createsCashMovement,
        shops: shopConfigs.map((sc) => ({
          id: sc.shopId,
          name: shopNameMap.get(sc.shopId) ?? '',
          isActive: sc.isActive,
        })),
      };
    });

    // 9️⃣ Paginación en memoria
    const start = (page - 1) * limit;
    const end = start + limit;
    const total = data.length;

    return {
      data: data.slice(start, end),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdatePaymentMethodDto, user: JwtPayload) {
    if (user.role === 'EMPLOYEE') {
      throw new ForbiddenException('No tienes permisos');
    }

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    if (paymentMethod.isSystem) {
      throw new ForbiddenException(
        'Los métodos del sistema no pueden modificarse',
      );
    }

    // 🔁 Update GLOBAL
    if (dto.name || dto.code || dto.description) {
      // unicidad de name/code
      if (dto.code || dto.name) {
        const exists = await this.paymentMethodRepository.findOne({
          where: [{ code: dto.code }, { name: dto.name }],
        });

        if (exists && exists.id !== id) {
          throw new BadRequestException(
            'Ya existe un método de pago con ese nombre o código',
          );
        }
      }

      this.paymentMethodRepository.merge(paymentMethod, {
        name: dto.name ?? paymentMethod.name,
        code: dto.code ?? paymentMethod.code,
        description: dto.description ?? paymentMethod.description,
      });

      await this.paymentMethodRepository.save(paymentMethod);
    }

    // 🔁 Update POR TIENDA
    for (const shopConfig of dto.shops) {
      const spm = await this.shopPaymentMethodRepository.findOne({
        where: {
          shopId: shopConfig.shopId,
          paymentMethodId: id,
        },
      });

      // ❌ Quitar método de tienda
      if (shopConfig.remove) {
        if (!spm) continue;

        const hasRelations =
          (await this.saleRepository.exist({
            where: {
              shopId: shopConfig.shopId,
              paymentMethodId: id,
            },
          })) ||
          (await this.purchaseRepository.exist({
            where: {
              shopId: shopConfig.shopId,
              paymentMethodId: id,
            },
          })) ||
          (await this.incomeRepository.exist({
            where: {
              shopId: shopConfig.shopId,
              paymentMethodId: id,
            },
          })) ||
          (await this.expenseRepository.exist({
            where: {
              shopId: shopConfig.shopId,
              paymentMethodId: id,
            },
          }));

        if (hasRelations) {
          throw new BadRequestException(
            `No se puede quitar el método de la tienda ${shopConfig.shopId} porque tiene movimientos asociados`,
          );
        }

        await this.shopPaymentMethodRepository.remove(spm);
        continue;
      }

      // ✅ Activar / desactivar
      if (spm && typeof shopConfig.isActive === 'boolean') {
        spm.isActive = shopConfig.isActive;
        await this.shopPaymentMethodRepository.save(spm);
      }
    }

    return {
      message: 'Método de pago actualizado correctamente',
    };
  }

  async delete(id: string, user: JwtPayload) {
    if (user.role === 'EMPLOYEE') {
      throw new ForbiddenException('No tienes permisos');
    }

    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Método de pago no encontrado');
    }

    if (paymentMethod.isSystem) {
      throw new ForbiddenException(
        'Los métodos del sistema no pueden eliminarse',
      );
    }

    // 🔍 Verificar asociaciones (GLOBAL, no por tienda)
    const hasRelations =
      (await this.saleRepository.exist({
        where: { paymentMethodId: id },
      })) ||
      (await this.purchaseRepository.exist({
        where: { paymentMethodId: id },
      })) ||
      (await this.incomeRepository.exist({
        where: { paymentMethodId: id },
      })) ||
      (await this.expenseRepository.exist({
        where: { paymentMethodId: id },
      }));

    // ⚠️ Tiene movimientos → desactivar SOLO ShopPaymentMethod
    if (hasRelations) {
      await this.shopPaymentMethodRepository.update(
        { paymentMethodId: id },
        { isActive: false },
      );

      return {
        message:
          'El método tiene movimientos asociados y fue desactivado en todas las tiendas para auditoría',
      };
    }

    // ✅ No tiene relaciones → delete físico
    await this.shopPaymentMethodRepository.delete({
      paymentMethodId: id,
    });

    await this.paymentMethodRepository.remove(paymentMethod);

    return {
      message: 'Método de pago eliminado correctamente',
    };
  }
}
