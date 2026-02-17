import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Between, DataSource, In } from 'typeorm';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { SaleReturnItem } from './entities/sale-return-item.entity';
import { SaleReturn, SaleReturnStatus } from './entities/sale-return.entity';
import { Sale, SaleStatus } from '@/sale/entities/sale.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import {
  CashMovementType,
  CashRegister,
} from '@/cash-register/entities/cash-register.entity';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class SaleReturnService {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateSaleReturnDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ Buscar venta
      const sale = await manager.findOne(Sale, {
        where: { id: dto.saleId, shopId: dto.shopId },
        relations: ['items', 'cashMovement'],
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException('Cannot return a cancelled sale');
      }

      if (sale.status === SaleStatus.DRAFT) {
        throw new BadRequestException('Cannot return a draft sale');
      }
      if (sale.status === SaleStatus.RETURNED) {
        throw new BadRequestException(
          'This sale has already been fully returned',
        );
      }

      if (!sale.cashMovement?.cashRegisterId) {
        throw new BadRequestException('Sale has no associated cash movement');
      }

      const cashRegister = await manager.findOne(CashRegister, {
        where: { id: sale.cashMovement.cashRegisterId },
      });

      if (!cashRegister || cashRegister.closedAt) {
        throw new BadRequestException('Cash register is closed');
      }
      let totalReturn = 0;
      for (const saleItem of sale.items) {
        const previousReturns = await manager.find(SaleReturnItem, {
          where: {
            saleItem: { id: saleItem.id },
          },
        });

        const returnedQty = previousReturns.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );

        if (returnedQty < Number(saleItem.quantity)) {
          // Hay al menos un item con stock pendiente de devolución
          break;
        }

        // Si todos los items están completamente devueltos
        if (saleItem === sale.items[sale.items.length - 1]) {
          throw new BadRequestException(
            'This sale has already been fully returned',
          );
        }
      }

      // 2️⃣ Crear cabecera de devolución
      const saleReturn = manager.create(SaleReturn, {
        saleId: sale.id,
        shopId: sale.shopId,
        refundMethod: dto.refundMethod,
        reason: dto.reason,
        createdBy: userId,
        total: 0,
        status: SaleReturnStatus.COMPLETED,
      });

      await manager.save(saleReturn);

      // 3️⃣ Procesar items
      for (const itemDto of dto.items) {
        const saleItem = sale.items.find((i) => i.id === itemDto.saleItemId);

        if (!saleItem) {
          throw new BadRequestException(
            `SaleItem ${itemDto.saleItemId} not found in sale`,
          );
        }

        // 🔎 Buscar devoluciones previas
        const previousReturns = await manager.find(SaleReturnItem, {
          where: {
            saleItem: {
              id: saleItem.id,
            },
          },
        });

        const returnedQty = previousReturns.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );

        const originalQty = Number(saleItem.quantity);
        const requestedQty = Number(itemDto.quantity);

        if (requestedQty <= 0) {
          throw new BadRequestException(
            'Return quantity must be greater than 0',
          );
        }

        if (returnedQty + requestedQty > originalQty) {
          throw new BadRequestException(
            `Cannot return more than sold quantity`,
          );
        }

        const unitPrice = Number(saleItem.unitPrice);
        const itemTotal = unitPrice * requestedQty;

        totalReturn += itemTotal;

        const saleReturnItem = manager.create(SaleReturnItem, {
          saleReturn: saleReturn,
          saleItem: saleItem, // 🔥 importante
          shopProductId: saleItem.shopProductId,
          quantity: itemDto.quantity,
          unitPrice: saleItem.unitPrice,
          refundAmount: itemTotal,
        });

        await manager.save(saleReturnItem);

        // 🔁 Reintegrar stock
        if (
          dto.returnCondition === 'DAMAGED' ||
          dto.returnCondition === 'EXPIRED'
        ) {
          await manager.increment(
            ShopProduct,
            { id: saleItem.shopProductId },
            'nonSellableStock',
            requestedQty,
          );
        } else {
          await manager.increment(
            ShopProduct,
            { id: saleItem.shopProductId },
            'stock',
            requestedQty,
          );
        }
      }

      // 4️⃣ Actualizar total de devolución
      saleReturn.total = totalReturn;
      await manager.save(saleReturn);

      // 5️⃣ Crear movimiento negativo en caja
      const cashMovement = manager.create(CashMovement, {
        cashRegisterId: sale.cashMovement.cashRegisterId,
        shopId: sale.shopId,
        type: CashMovementType.SALE_RETURN,
        amount: -totalReturn,
        saleReturnId: saleReturn.id,
        userId,
        description: `Return of sale ${sale.id}`,
      });

      await manager.save(cashMovement);

      // 6️⃣ Evaluar estado de venta
      const allReturns = await manager.find(SaleReturn, {
        where: { saleId: sale.id },
      });

      const totalReturnedAmount = allReturns.reduce(
        (sum, r) => sum + Number(r.total),
        0,
      );

      if (totalReturnedAmount >= Number(sale.totalAmount)) {
        sale.status = SaleStatus.RETURNED;
        await manager.save(sale);
      } else {
        sale.status = SaleStatus.COMPLETED;
        await manager.save(sale);
      }

      return saleReturn;
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

    // 🔐 VISIBILIDAD POR ROL

    if (user.role === 'EMPLOYEE') {
      where.createdBy = user.id;
    }

    if (user.role === 'MANAGER') {
      if (!user.shopIds || user.shopIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }

      where.shopId = filters.shopId ? filters.shopId : In(user.shopIds);
    }

    if (user.role === 'OWNER') {
      if (filters.shopId) {
        where.shopId = filters.shopId;
      }
    }

    // 📅 RANGO DE FECHAS

    if (filters.fromDate && filters.toDate) {
      where.createdAt = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    const [returns, total] = await this.dataSource
      .getRepository(SaleReturn)
      .findAndCount({
        where,
        relations: {
          shop: true,
          sale: true,
          items: {
            saleItem: {
              shopProduct: {
                product: true,
              },
            },
          },
        },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      });

    return {
      data: returns.map((ret) => ({
        id: ret.id,
        shop: ret.shop?.name ?? null,
        saleId: ret.saleId,
        refundMethod: ret.refundMethod,
        reason: ret.reason,
        total: ret.total,
        createdAt: ret.createdAt,
        items: ret.items.map((item) => ({
          product: item.saleItem?.shopProduct?.product?.name ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: Number(item.quantity) * Number(item.unitPrice),
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
