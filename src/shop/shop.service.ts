import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CreateShopDto } from './dto/create-shop.dto';
import { JwtPayload } from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { Shop } from './entities/shop.entity';
import { Repository } from 'typeorm';
import { normalizeShopConfig } from './utils/normalize-shop-config';
import { UserShop, UserShopRole } from '@/auth/entities/user-shop.entity';
import { UpdateShopDto } from './dto/update-shop.dto';
import { BillingService } from '@/billing/billing.service';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    @InjectRepository(UserShop)
    private readonly userShopRepository: Repository<UserShop>,
    private readonly billingService: BillingService,
  ) {}
  async createShop(user: JwtPayload, dto: CreateShopDto) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Solo un Dueño puede crear tiendas');
    }
    const countryCode = dto.countryCode.toUpperCase();

    const hasActiveSubscription = await this.billingService.hasActiveSubscription(
      user.id,
    );
    const maxShopsAllowed = hasActiveSubscription ? 3 : 1;

    const shopCount = await this.shopRepository.count({
      where: { ownerId: user.id },
    });
    if (shopCount >= maxShopsAllowed) {
      throw new ForbiddenException(
        hasActiveSubscription
          ? 'Ya alcanzaste el límite de 3 tiendas permitidas con tu suscripción'
          : 'Con el plan gratuito solo puedes crear 1 tienda. Contrata una suscripción para crear más.',
      );
    }

    const { timezone, currency } = normalizeShopConfig({
      countryCode,
      currencyCode: dto.currencyCode,
    });
    const shop = this.shopRepository.create({
      ...dto,
      ownerId: user.id,
      countryCode,
      currency: currency,
      timezone,
    });

    await this.shopRepository.save(shop);

    await this.userShopRepository.save(
      this.userShopRepository.create({
        userId: user.id,
        shopId: shop.id,
        role: UserShopRole.OWNER, // o OWNER si querés diferenciar
      }),
    );
    return {
      message: 'Tienda creada correctamente',
      shop,
    };
  }

  async getMyShops(user: JwtPayload) {
    if (user.role === 'OWNER') {
      const shops = await this.shopRepository.find({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          countryCode: true,
          currency: true,
          timezone: true,
          isActive: true,
        },
        order: { createdAt: 'ASC' },
      });

      return {
        message: 'Mis tiendas',
        data: shops,
      };
    }

    const userShops = await this.userShopRepository.find({
      where: { userId: user.id },
      relations: {
        shop: true,
      },
    });

    const shops = userShops.map((us) => ({
      id: us.shop.id,
      name: us.shop.name,
      address: us.shop.address,
      phone: us.shop.phone,
      countryCode: us.shop.countryCode,
      currency: us.shop.currency,
      timezone: us.shop.timezone,
      isActive: us.shop.isActive,
      role: us.role,
    }));

    return {
      message: 'Tiendas asignadas',
      data: shops,
    };
  }

  async getShopById(id: string, user: JwtPayload) {
    const canAccess =
      user.role === 'OWNER'
        ? await this.shopRepository.exist({
            where: { id, ownerId: user.id },
          })
        : await this.userShopRepository.exist({
            where: { shopId: id, userId: user.id },
          });

    if (!canAccess) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }

    const shop = await this.shopRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        countryCode: true,
        currency: true,
        timezone: true,
      },
      //   relations: {
      //     paymentMethods: true,
      //     productCategories: true,
      //     supplierCategories: true,
      //     measurementUnits: true,
      //     stockAlerts: true,
      //     cashRegisters: true,
      //   },
    });

    if (!shop) {
      throw new BadRequestException('Tienda no encontrada');
    }

    return {
      message: 'Tienda encontrada',
      data: shop,
    };
  }

  async updateShop(id: string, dto: UpdateShopDto, user: JwtPayload) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Solo un Dueño puede actualizar tiendas');
    }

    const shop = await this.shopRepository.findOne({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!shop) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }

    let timezone = shop.timezone;
    let currency = shop.currency;
    let countryCode = shop.countryCode;

    if (dto.countryCode || dto.currencyCode) {
      const normalized = normalizeShopConfig({
        countryCode: dto.countryCode ?? shop.countryCode,
        currencyCode: dto.currencyCode ?? shop.currency,
      });

      timezone = normalized.timezone;
      currency = normalized.currency;
      countryCode = (dto.countryCode ?? shop.countryCode).toUpperCase();
    }

    this.shopRepository.merge(shop, {
      ...dto,
      countryCode,
      currency,
      timezone,
    });

    await this.shopRepository.save(shop);

    return {
      message: 'Tienda actualizada correctamente',
      shop,
    };
  }

  async assertCanAccessShop(shopId: string, user: JwtPayload): Promise<void> {
    const canAccess =
      user.role === 'OWNER'
        ? await this.shopRepository.exist({
            where: { id: shopId, ownerId: user.id },
          })
        : await this.userShopRepository.exist({
            where: { shopId, userId: user.id },
          });

    if (!canAccess) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }
  }
}
