import { BadRequestException, Injectable } from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { Between, DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import {
  ProductHistory,
  ProductHistoryChangeType,
} from '@/product/entities/product-history.entity';
import { PaymentMethod } from '@/payment-method/entities/payment-method.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { PurchaseStatus } from '@/purchase-return/entities/purchase-return.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import {
  CashMovementType,
  CashRegister,
} from '@/cash-register/entities/cash-register.entity';
import { JwtPayload } from 'jsonwebtoken';
import { CashRegisterStatus } from '@/cash-register/enums/cash-register-status.enum';
import { CashMovementService } from '@/cash-movement/cash-movement.service';
import { CashRegisterService } from '@/cash-register/cash-register.service';

@Injectable()
export class PurchaseService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepo: Repository<ShopProduct>,
    @InjectRepository(ProductHistory)
    private readonly productHistoryRepo: Repository<ProductHistory>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    private readonly cashRegisterService: CashRegisterService,
    private readonly cashMovementService: CashMovementService,
  ) {}
  async createPurchase(dto: CreatePurchaseDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const paymentMethod = await manager.findOne(PaymentMethod, {
        where: { id: dto.paymentMethodId },
      });

      if (!paymentMethod) {
        throw new BadRequestException('Payment method not found');
      }

      if (!dto.items.length) {
        throw new BadRequestException('Purchase must have at least one item');
      }

      // 1️⃣ Crear Purchase
      const purchase = manager.create(Purchase, {
        shopId: dto.shopId,
        supplier: dto.supplierId ? { id: dto.supplierId } : null,
        paymentMethod,
        purchaseDate: dto.purchaseDate ?? new Date(),
        notes: dto.notes ?? null,
        status: PurchaseStatus.COMPLETED,
      });

      await manager.save(purchase);

      let totalAmount = 0;

      // 2️⃣ Procesar items
      for (const item of dto.items) {
        const shopProduct = await manager.findOne(ShopProduct, {
          where: {
            id: item.shopProductId,
            shopId: dto.shopId,
          },
        });

        if (!shopProduct) {
          throw new BadRequestException(
            `Product ${item.shopProductId} not found in shop`,
          );
        }

        const subtotal = item.quantity * item.unitCost;
        totalAmount += subtotal;

        // 2.1 PurchaseItem
        const purchaseItem = manager.create(PurchaseItem, {
          purchase,
          shopProduct,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal,
        });

        await manager.save(purchaseItem);

        // 2.2 Actualizar stock
        shopProduct.stock = (shopProduct.stock ?? 0) + item.quantity;
        await manager.save(shopProduct);

        // 2.3 ProductHistory
        const history = manager.create(ProductHistory, {
          shopProduct: { id: shopProduct.id },
          purchase: { id: purchase.id },
          userId: user.id,
          changeType: ProductHistoryChangeType.PURCHASE,
          previousStock: shopProduct.stock - item.quantity,
          newStock: shopProduct.stock,
          previousCost: shopProduct.costPrice,
          newCost: item.unitCost,
          note: 'Ingreso por compra',
        });
        await manager.save(history);
      }

      // 3️⃣ Total
      purchase.totalAmount = totalAmount;
      await manager.save(purchase);

      // 4️⃣ Cash movement (si aplica)
      const cashRegister = await this.cashRegisterService.getCurrentForUser(
        dto.shopId,
        user.id,
      );

      if (!cashRegister) {
        throw new BadRequestException(
          'Debes tener una caja abierta para registrar una compra',
        );
      }
      if (paymentMethod.createsCashMovement) {
        const movement = manager.create(CashMovement, {
          cashRegisterId: cashRegister.id, // ✅ CLAVE
          shopId: dto.shopId,
          type: CashMovementType.EXPENSE,
          amount: totalAmount,
          userId: user.id,
          description: `Compra ${purchase.id}`,
          purchaseId: purchase.id, // ✅ como en expenses/incomes
        });

        await manager.save(movement);
      }

      return {
        id: purchase.id,
        shopId: purchase.shopId,
        supplierId: dto.supplierId ?? null,
        paymentMethodId: dto.paymentMethodId,
        totalAmount: purchase.totalAmount,
        purchaseDate: purchase.purchaseDate,
        status: purchase.status,
      };
    });
  }

  async getAll(
    filters: {
      shopId?: string;
      fromDate?: string;
      toDate?: string;
      page?: number;
      limit?: number;
    },
    user: JwtPayload,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    // 🔐 reglas por rol (resumido)
    if (user.role === 'EMPLOYEE') {
      where.createdBy = user.id;
    } else if (filters.shopId) {
      where.shopId = filters.shopId;
    }

    if (filters.fromDate && filters.toDate) {
      where.purchaseDate = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    const [purchases, total] = await this.purchaseRepo.findAndCount({
      where,
      relations: {
        shop: true,
        supplier: true,
        paymentMethod: true,
        items: {
          shopProduct: {
            product: true,
          },
        },
      },
      order: {
        purchaseDate: 'DESC',
      },
      skip,
      take: limit,
    });

    return {
      data: purchases.map((purchase) => ({
        id: purchase.id,
        shop: purchase.shop.name,
        supplier: purchase.supplier?.name ?? null,
        paymentMethod: purchase.paymentMethod.name,
        items: purchase.items.map((item) => ({
          product: item.shopProduct.product.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
        })),
        totalAmount: purchase.totalAmount,
        purchaseDate: purchase.purchaseDate,
        status: purchase.status,
        notes: purchase.notes,
      })),
      total,
      page,
      limit,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} purchase`;
  }

  update(id: number, updatePurchaseDto: UpdatePurchaseDto) {
    return `This action updates a #${id} purchase`;
  }

  remove(id: number) {
    return `This action removes a #${id} purchase`;
  }
}
