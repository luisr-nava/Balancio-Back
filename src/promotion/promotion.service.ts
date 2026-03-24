import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Promotion, PromotionScopeType, PromotionType } from './entities/promotion.entity';
import { PromotionItem } from './entities/promotion-item.entity';
import { PromotionBenefit, BenefitType } from './entities/promotion-benefit.entity';
import { PromotionShop } from './entities/promotion-shop.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { CartItemDto } from './dto/evaluate-promotions.dto';
import { User, UserRole } from '@/auth/entities/user.entity';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { PromotionCreatedEvent } from './events/promotion-created.event';

// ── result shapes ──────────────────────────────────────────────────────────────

export interface PromotionPreview {
  promotionId: string;
  name: string;
  type: PromotionType;
  description: string;
  timesApplicable: number;
  savings: number;
  previewTotal: number;
}

export interface ApplyResult {
  totalOriginal: number;
  totalWithDiscount: number;
  savings: number;
  appliedPromotion: {
    id: string;
    name: string;
    timesApplied: number;
  };
}

// ── pure calculation helpers ───────────────────────────────────────────────────

function calculateTimes(
  cartItems: CartItemDto[],
  promotionItems: PromotionItem[],
): number {
  if (!promotionItems.length) return 0;

  let times = Infinity;
  for (const req of promotionItems) {
    const found = cartItems.find((i) => i.shopProductId === req.shopProductId);
    if (!found || found.quantity < req.quantity) return 0;
    times = Math.min(times, Math.floor(found.quantity / req.quantity));
  }
  return times === Infinity ? 0 : times;
}

function calculateComboTotal(
  cartItems: CartItemDto[],
  promotionItems: PromotionItem[],
): number {
  return promotionItems.reduce((sum, req) => {
    const found = cartItems.find((i) => i.shopProductId === req.shopProductId);
    if (!found) return sum;
    return sum + req.quantity * found.unitPrice;
  }, 0);
}

function calculateSavings(
  cartItems: CartItemDto[],
  promotionItems: PromotionItem[],
  benefit: PromotionBenefit,
  times: number,
): number {
  if (times === 0) return 0;

  switch (benefit.type) {
    case BenefitType.PERCENT: {
      const comboTotal = calculateComboTotal(cartItems, promotionItems);
      return +((comboTotal * times * benefit.value) / 100).toFixed(2);
    }
    case BenefitType.FIXED_PRICE: {
      const comboTotal = calculateComboTotal(cartItems, promotionItems);
      const savingsPerApplication = Math.max(0, comboTotal - benefit.value);
      return +(savingsPerApplication * times).toFixed(2);
    }
    case BenefitType.FREE_ITEM: {
      if (!benefit.freeProductId) return 0;
      const freeItem = cartItems.find(
        (i) => i.shopProductId === benefit.freeProductId,
      );
      if (!freeItem) return 0;
      const freeQtyPerApplication = benefit.freeQuantity ?? 1;
      const totalFree = freeQtyPerApplication * times;
      const actualFree = Math.min(totalFree, freeItem.quantity);
      return +(freeItem.unitPrice * actualFree).toFixed(2);
    }
    default:
      return 0;
  }
}

function buildDescription(benefit: PromotionBenefit, times: number): string {
  const mult = times > 1 ? ` (×${times})` : '';
  switch (benefit.type) {
    case BenefitType.PERCENT:
      return `${benefit.value}% de descuento${mult}`;
    case BenefitType.FIXED_PRICE:
      return `Combo a precio fijo $${benefit.value}${mult}`;
    case BenefitType.FREE_ITEM:
      return `${(benefit.freeQuantity ?? 1) * times} unidad(es) gratis`;
    default:
      return '';
  }
}

function isPromotionDateValid(promotion: Promotion): boolean {
  const now = new Date();
  if (promotion.startDate && promotion.startDate > now) return false;
  if (promotion.endDate && promotion.endDate < now) return false;
  return true;
}

// ── service ────────────────────────────────────────────────────────────────────

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepo: Repository<Promotion>,
    @InjectRepository(PromotionItem)
    private readonly itemRepo: Repository<PromotionItem>,
    @InjectRepository(PromotionBenefit)
    private readonly benefitRepo: Repository<PromotionBenefit>,
    @InjectRepository(PromotionShop)
    private readonly promotionShopRepo: Repository<PromotionShop>,
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async getUserShopIds(userId: string): Promise<string[]> {
    const userShops = await this.userShopRepo.find({ where: { userId } });
    return userShops.map((us) => us.shopId);
  }

  /** Base query builder that filters promotions valid for a given shopId */
  private scopedQuery(shopId: string) {
    return this.promotionRepo
      .createQueryBuilder('p')
      .leftJoin('p.shops', 'shopScope', 'shopScope.shopId = :shopId', {
        shopId,
      })
      .where(
        '(p.scopeType = :all OR shopScope.id IS NOT NULL)',
        { all: PromotionScopeType.ALL },
      );
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async create(dto: CreatePromotionDto, user: User): Promise<Promotion> {
    // 1a. Validate PERCENT value max
    if (dto.benefit.type === BenefitType.PERCENT && (dto.benefit.value ?? 0) > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%');
    }

    // 1. Validate scope vs role
    if (dto.scopeType === PromotionScopeType.ALL && user.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Solo el dueño puede crear promociones para todas las tiendas',
      );
    }

    if (dto.scopeType === PromotionScopeType.SPECIFIC) {
      if (!dto.shopIds?.length) {
        throw new BadRequestException(
          'Debes especificar al menos una tienda para una promoción de alcance específico',
        );
      }

      // Validate all shopIds belong to user
      const userShopIds = await this.getUserShopIds(user.id);
      const invalidShops = dto.shopIds.filter((id) => !userShopIds.includes(id));
      if (invalidShops.length) {
        throw new ForbiddenException(
          'No tienes acceso a algunas de las tiendas especificadas',
        );
      }
    }

    // 2. Persist promotion
    const promotion = this.promotionRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      scopeType: dto.scopeType,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      priority: dto.priority ?? 0,
      isActive: true,
    });
    const saved = await this.promotionRepo.save(promotion);

    // 3. Items
    const items = dto.items.map((i) =>
      this.itemRepo.create({
        promotionId: saved.id,
        shopProductId: i.shopProductId,
        quantity: i.quantity,
      }),
    );
    await this.itemRepo.save(items);

    // 4. Benefit
    const benefit = this.benefitRepo.create({
      promotionId: saved.id,
      type: dto.benefit.type,
      value: dto.benefit.value,
      freeProductId: dto.benefit.freeProductId ?? null,
      freeQuantity: dto.benefit.freeQuantity ?? null,
    });
    await this.benefitRepo.save(benefit);

    // 5. PromotionShop records & determine shopIds for event
    let eventShopIds: string[];

    if (dto.scopeType === PromotionScopeType.SPECIFIC) {
      const shopRecords = dto.shopIds!.map((shopId) =>
        this.promotionShopRepo.create({ promotionId: saved.id, shopId }),
      );
      await this.promotionShopRepo.save(shopRecords);
      eventShopIds = dto.shopIds!;
    } else {
      // ALL scope: get creator's shops for notification purposes
      eventShopIds = await this.getUserShopIds(user.id);
    }

    // 6. Emit domain event (decoupled notification handled by listener)
    const event: PromotionCreatedEvent = {
      promotionId: saved.id,
      createdByUserId: user.id,
      createdByRole: user.role,
      shopIds: eventShopIds,
      name: saved.name,
      ownerId: user.ownerId ?? user.id,
    };
    this.eventEmitter.emit('promotion.created', event);

    return this.findById(saved.id);
  }

  /** Returns all promotions the user has access to (via shops or ALL scope) */
  async findMyPromotions(user: User): Promise<Promotion[]> {
    const userShopIds = await this.getUserShopIds(user.id);

    if (!userShopIds.length) return [];

    return this.promotionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.benefits', 'benefits')
      .leftJoinAndSelect('p.shops', 'shops')
      .leftJoin('p.shops', 'shopScope', 'shopScope.shopId IN (:...shopIds)', {
        shopIds: userShopIds,
      })
      .where('p.isActive = true')
      .andWhere(
        '(p.scopeType = :all OR shopScope.id IS NOT NULL)',
        { all: PromotionScopeType.ALL },
      )
      .orderBy('p.priority', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async findAll(shopId: string): Promise<Promotion[]> {
    return this.scopedQuery(shopId)
      .andWhere('p.isActive = true')
      .orderBy('p.priority', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({
      where: { id },
      relations: { shops: true },
    });
    if (!promotion) throw new NotFoundException('Promoción no encontrada');
    return promotion;
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
    user: User,
  ): Promise<Promotion> {
    const promotion = await this.findById(id);

    if (dto.benefit?.type === BenefitType.PERCENT && (dto.benefit.value ?? 0) > 100) {
      throw new BadRequestException('El porcentaje no puede superar el 100%');
    }

    if (dto.name !== undefined) promotion.name = dto.name;
    if (dto.description !== undefined) promotion.description = dto.description ?? null;
    if (dto.type !== undefined) promotion.type = dto.type;
    if (dto.priority !== undefined) promotion.priority = dto.priority;
    if (dto.startDate !== undefined)
      promotion.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined)
      promotion.endDate = dto.endDate ? new Date(dto.endDate) : null;

    // Scope / shops update
    if (dto.scopeType !== undefined) {
      if (dto.scopeType === PromotionScopeType.ALL && user.role !== UserRole.OWNER) {
        throw new ForbiddenException(
          'Solo el dueño puede cambiar una promoción a alcance global',
        );
      }
      promotion.scopeType = dto.scopeType;
    }

    if (dto.items !== undefined) {
      await this.itemRepo.delete({ promotionId: id });
      const items = dto.items.map((i) =>
        this.itemRepo.create({
          promotionId: id,
          shopProductId: i.shopProductId,
          quantity: i.quantity,
        }),
      );
      await this.itemRepo.save(items);
    }

    if (dto.benefit !== undefined) {
      await this.benefitRepo.delete({ promotionId: id });
      const benefit = this.benefitRepo.create({
        promotionId: id,
        type: dto.benefit.type,
        value: dto.benefit.value,
        freeProductId: dto.benefit.freeProductId ?? null,
        freeQuantity: dto.benefit.freeQuantity ?? null,
      });
      await this.benefitRepo.save(benefit);
    }

    // Re-create shop associations if shopIds provided
    if (dto.shopIds !== undefined) {
      const userShopIds = await this.getUserShopIds(user.id);
      const invalidShops = dto.shopIds.filter((sid) => !userShopIds.includes(sid));
      if (invalidShops.length) {
        throw new ForbiddenException(
          'No tienes acceso a algunas de las tiendas especificadas',
        );
      }
      await this.promotionShopRepo.delete({ promotionId: id });
      if (dto.shopIds.length) {
        const shopRecords = dto.shopIds.map((shopId) =>
          this.promotionShopRepo.create({ promotionId: id, shopId }),
        );
        await this.promotionShopRepo.save(shopRecords);
      }
    }

    await this.promotionRepo.save(promotion);
    return this.findById(id);
  }

  async remove(id: string, _user: User): Promise<{ message: string }> {
    const promotion = await this.findById(id);
    promotion.isActive = false;
    await this.promotionRepo.save(promotion);
    return { message: 'Promoción desactivada correctamente' };
  }

  // ── EVALUATION (non-destructive) ─────────────────────────────────────────────

  async evaluatePromotions(
    cartItems: CartItemDto[],
    shopId: string,
  ): Promise<PromotionPreview[]> {
    if (!cartItems.length) return [];

    const now = new Date();
    const promotions = await this.scopedQuery(shopId)
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.benefits', 'benefits')
      .andWhere('p.isActive = true')
      .andWhere('(p.startDate IS NULL OR p.startDate <= :now)', { now })
      .andWhere('(p.endDate IS NULL OR p.endDate >= :now)', { now })
      .orderBy('p.priority', 'DESC')
      .getMany();

    const totalOriginal = +cartItems
      .reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      .toFixed(2);

    const previews: PromotionPreview[] = [];

    for (const promotion of promotions) {
      if (!promotion.items?.length || !promotion.benefits?.length) continue;

      const times = calculateTimes(cartItems, promotion.items);
      if (times === 0) continue;

      const benefit = promotion.benefits[0];
      const savings = calculateSavings(cartItems, promotion.items, benefit, times);

      previews.push({
        promotionId: promotion.id,
        name: promotion.name,
        type: promotion.type,
        description: buildDescription(benefit, times),
        timesApplicable: times,
        savings,
        previewTotal: +(totalOriginal - savings).toFixed(2),
      });
    }

    return previews.sort((a, b) => b.savings - a.savings);
  }

  // ── APPLICATION ──────────────────────────────────────────────────────────────

  async applyPromotion(
    cartItems: CartItemDto[],
    promotionId: string,
    shopId: string,
  ): Promise<ApplyResult> {
    if (!cartItems.length) {
      throw new BadRequestException('El carrito está vacío');
    }

    const promotion = await this.promotionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.benefits', 'benefits')
      .leftJoin('p.shops', 'shopScope', 'shopScope.shopId = :shopId', { shopId })
      .where('p.id = :promotionId', { promotionId })
      .andWhere('p.isActive = true')
      .getOne();

    if (!promotion) {
      throw new NotFoundException('Promoción no encontrada o inactiva');
    }

    // ── scope guard: validate promotion applies to this shop ──────────────────
    if (promotion.scopeType === PromotionScopeType.SPECIFIC) {
      const shopRecord = await this.promotionShopRepo.findOne({
        where: { promotionId, shopId },
      });
      if (!shopRecord) {
        throw new ForbiddenException('La promoción no aplica a esta tienda');
      }
    }

    if (!isPromotionDateValid(promotion)) {
      throw new BadRequestException('La promoción no está vigente en esta fecha');
    }

    const times = calculateTimes(cartItems, promotion.items);
    if (times === 0) {
      throw new BadRequestException(
        'El carrito no cumple las condiciones de la promoción',
      );
    }

    const benefit = promotion.benefits[0];
    const totalOriginal = +cartItems
      .reduce((s, i) => s + i.quantity * i.unitPrice, 0)
      .toFixed(2);
    const savings = calculateSavings(cartItems, promotion.items, benefit, times);
    const totalWithDiscount = +(totalOriginal - savings).toFixed(2);

    return {
      totalOriginal,
      totalWithDiscount,
      savings,
      appliedPromotion: {
        id: promotion.id,
        name: promotion.name,
        timesApplied: times,
      },
    };
  }
}
