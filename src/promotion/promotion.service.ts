import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion, PromotionType } from './entities/promotion.entity';
import { PromotionItem } from './entities/promotion-item.entity';
import { PromotionBenefit, BenefitType } from './entities/promotion-benefit.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { CartItemDto } from './dto/evaluate-promotions.dto';
import { User } from '@/auth/entities/user.entity';

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

/**
 * How many full times the promotion can be applied given the cart quantities.
 * e.g. promo needs 2x Fernet — if cart has 5, times = floor(5/2) = 2.
 * Returns 0 if ANY required product is missing or insufficient.
 */
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

/**
 * Total price of a single set of combo items (1× application).
 * Ignores other products in the cart.
 */
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

/**
 * Total savings produced by `times` applications of the promotion.
 *
 * PERCENT:
 *   savings = comboTotal × times × (value / 100)
 *
 * FIXED_PRICE:
 *   savings = (comboTotal − fixedPrice) × times
 *   — calculated only on combo products, not the whole cart
 *
 * FREE_ITEM:
 *   freeQty = freeQuantityPerApplication × times
 *   capped at the actual quantity of that product in the cart
 *   savings = freeItem.unitPrice × actualFree
 */
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

// ── shared query helper ────────────────────────────────────────────────────────

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
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async create(dto: CreatePromotionDto, _user: User): Promise<Promotion> {
    const promotion = this.promotionRepo.create({
      shopId: dto.shopId,
      name: dto.name,
      type: dto.type,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      priority: dto.priority ?? 0,
      isActive: true,
    });

    const saved = await this.promotionRepo.save(promotion);

    const items = dto.items.map((i) =>
      this.itemRepo.create({
        promotionId: saved.id,
        shopProductId: i.shopProductId,
        quantity: i.quantity,
      }),
    );
    await this.itemRepo.save(items);

    const benefit = this.benefitRepo.create({
      promotionId: saved.id,
      type: dto.benefit.type,
      value: dto.benefit.value,
      freeProductId: dto.benefit.freeProductId ?? null,
      freeQuantity: dto.benefit.freeQuantity ?? null,
    });
    await this.benefitRepo.save(benefit);

    return this.findById(saved.id);
  }

  async findAll(shopId: string): Promise<Promotion[]> {
    return this.promotionRepo.find({
      where: { shopId, isActive: true },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepo.findOne({ where: { id } });
    if (!promotion) throw new NotFoundException('Promoción no encontrada');
    return promotion;
  }

  async update(
    id: string,
    dto: UpdatePromotionDto,
    _user: User,
  ): Promise<Promotion> {
    const promotion = await this.findById(id);

    if (dto.name !== undefined) promotion.name = dto.name;
    if (dto.type !== undefined) promotion.type = dto.type;
    if (dto.priority !== undefined) promotion.priority = dto.priority;
    if (dto.startDate !== undefined)
      promotion.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined)
      promotion.endDate = dto.endDate ? new Date(dto.endDate) : null;

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

    await this.promotionRepo.save(promotion);
    return this.findById(id);
  }

  async remove(id: string, _user: User): Promise<{ message: string }> {
    const promotion = await this.findById(id);
    promotion.isActive = false;
    await this.promotionRepo.save(promotion);
    return { message: 'Promoción desactivada correctamente' };
  }

  // ── EVALUATION (non-destructive) ────────────────────────────────────────────

  /**
   * Returns all applicable promotions for the cart WITHOUT modifying anything.
   * Each preview includes how many times the promo applies and the total savings.
   * Ordered by savings DESC so the frontend can highlight the best deal.
   */
  async evaluatePromotions(
    cartItems: CartItemDto[],
    shopId: string,
  ): Promise<PromotionPreview[]> {
    if (!cartItems.length) return [];

    const now = new Date();
    const promotions = await this.promotionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.benefits', 'benefits')
      .where('p.shopId = :shopId', { shopId })
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

  /**
   * Applies ONE selected promotion to the cart.
   * Does NOT persist anything — the caller (SaleService) stores the result.
   *
   * Security: validates promotion.shopId === shopId to prevent cross-shop abuse.
   * Calculation: uses combo-scoped totals, not the full cart total.
   */
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
      .where('p.id = :promotionId', { promotionId })
      .andWhere('p.isActive = true')
      .getOne();

    if (!promotion) {
      throw new NotFoundException('Promoción no encontrada o inactiva');
    }

    // ── security: cross-shop guard ──────────────────────────────────────────
    if (promotion.shopId !== shopId) {
      throw new ForbiddenException(
        'La promoción no pertenece a esta tienda',
      );
    }

    // ── date validation ─────────────────────────────────────────────────────
    if (!isPromotionDateValid(promotion)) {
      throw new BadRequestException(
        'La promoción no está vigente en esta fecha',
      );
    }

    // ── cart conditions ─────────────────────────────────────────────────────
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
