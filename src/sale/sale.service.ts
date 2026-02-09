import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { DataSource, Repository } from 'typeorm';
import { PaymentStatus, Sale, SaleStatus } from './entities/sale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { SaleItem } from './entities/sale-item.entity';
import { ShopProduct } from '@/product/entities/shop-product.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { SaleHistory, SaleHistoryAction } from './entities/sale-history.entity';
import { SaleItemHistory } from './entities/sale-item-history.entity';
import { CashRegisterService } from '@/cash-register/cash-register.service';
import { CashRegisterStatus } from '@/cash-register/enums/cash-register-status.enum';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { JwtPayload } from 'jsonwebtoken';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';

@Injectable()
export class SaleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepo: Repository<SaleItem>,
    @InjectRepository(ShopProduct)
    private readonly shopProductRepo: Repository<ShopProduct>,
    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    @InjectRepository(SaleHistory)
    private readonly saleHistoryRepo: Repository<SaleHistory>,
    @InjectRepository(SaleItemHistory)
    private readonly saleItemHistoryRepo: Repository<SaleItemHistory>,
    private readonly cashRegisterService: CashRegisterService,
  ) {}
  async create(dto: CreateSaleDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ Caja abierta obligatoria
      const cashRegister = await this.cashRegisterService.getCurrentForUser(
        dto.shopId,
        user.id,
      );

      if (!cashRegister) {
        throw new BadRequestException(
          'Debe haber una caja abierta para registrar una venta',
        );
      }

      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('La venta debe tener al menos un item');
      }

      // 2️⃣ Calcular totales ANTES de crear la venta
      let saleSubtotal = 0;
      let saleTaxAmount = 0;
      let saleTotal = 0;

      for (const item of dto.items) {
        const quantity = Number(item.quantity);

        if (quantity <= 0) {
          throw new BadRequestException(
            `Cantidad inválida para el producto ${item.shopProductId}`,
          );
        }

        const itemSubtotal = quantity * item.unitPrice;
        const itemTax = item.taxRate ? itemSubtotal * item.taxRate : 0;
        const itemDiscount = item.discount ?? 0;
        const itemTotal = itemSubtotal - itemDiscount + itemTax;

        saleSubtotal += itemSubtotal;
        saleTaxAmount += itemTax;
        saleTotal += itemTotal;
      }

      // 3️⃣ Crear venta (YA con totales válidos)
      const sale = manager.create(Sale, {
        shopId: dto.shopId,
        customerId: dto.customerId ?? null,
        employeeId: user.id,
        paymentMethodId: dto.paymentMethodId,
        subtotal: saleSubtotal,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: saleTaxAmount,
        totalAmount: saleTotal,
        paymentStatus: dto.paymentStatus ?? PaymentStatus.PAID,
        invoiceType: dto.invoiceType ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        notes: dto.notes ?? null,
        status: SaleStatus.COMPLETED,
        saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
      });

      await manager.save(sale);

      // 4️⃣ Items + stock + history
      for (const item of dto.items) {
        const shopProduct = await manager.findOne(ShopProduct, {
          where: { id: item.shopProductId, shopId: dto.shopId },
        });

        if (!shopProduct) {
          throw new BadRequestException(
            `Producto ${item.shopProductId} no encontrado`,
          );
        }

        const quantity = Number(item.quantity);
        const subtotal = quantity * item.unitPrice;
        const taxAmount = item.taxRate ? subtotal * item.taxRate : 0;
        const discount = item.discount ?? 0;
        const total = subtotal - discount + taxAmount;

        const saleItem = manager.create(SaleItem, {
          sale,
          saleId: sale.id,
          shopProduct,
          shopProductId: shopProduct.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
          discount,
          taxRate: item.taxRate ?? 0,
          taxAmount,
          total,
          priceWasModified: item.priceWasModified ?? false,
        });

        await manager.save(saleItem);

        // stock ↓
        shopProduct.stock = (shopProduct.stock ?? 0) - quantity;
        await manager.save(shopProduct);

        // item history (snapshot)
        await manager.save(
          manager.create(SaleItemHistory, {
            saleId: sale.id,
            shopProductId: shopProduct.id,
            snapshot: {
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount,
              taxRate: item.taxRate ?? 0,
              priceWasModified: item.priceWasModified ?? false,
            },
          }),
        );
      }

      // 5️⃣ Cash movement (solo si está paga)
      if (sale.paymentStatus === PaymentStatus.PAID) {
        const movement = manager.create(CashMovement, {
          cashRegisterId: cashRegister.id,
          shopId: dto.shopId,
          userId: user.id,
          type: CashMovementType.INCOME,
          amount: sale.totalAmount,
          description: `Venta ${sale.id}`,
          saleId: sale.id,
        });

        await manager.save(movement);
        sale.cashMovement = movement;
        await manager.save(sale);
      }

      // 6️⃣ Sale history
     await manager.save(
       manager.create(SaleHistory, {
         sale,
         saleId: sale.id,
         userId: user.id,
         action: SaleHistoryAction.CREATED,
         snapshot: {
           shopId: sale.shopId,
           customerId: sale.customerId,
           paymentMethodId: sale.paymentMethodId,
           subtotal: sale.subtotal,
           taxAmount: sale.taxAmount,
           totalAmount: sale.totalAmount,
           paymentStatus: sale.paymentStatus,
           status: sale.status,
           saleDate: sale.saleDate,
           items: dto.items.map((i) => ({
             shopProductId: i.shopProductId,
             quantity: i.quantity,
             unitPrice: i.unitPrice,
             discount: i.discount ?? 0,
             taxRate: i.taxRate ?? 0,
             priceWasModified: i.priceWasModified ?? false,
           })),
         },
       }),
     );


      return {
        id: sale.id,
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        saleDate: sale.saleDate,
      };
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE SALE
  // ─────────────────────────────────────────────
  async update(id: string, dto: UpdateSaleDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id },
        relations: ['items', 'cashMovement'],
      });

      if (!sale) {
        throw new BadRequestException('Venta no encontrada');
      }

      // 1️⃣ La venta pertenece a una caja cerrada
      if (sale.cashMovement?.cashRegisterId) {
        const cashRegister = await this.cashRegisterService.getById(
          sale.cashMovement.cashRegisterId,
        );

        if (cashRegister?.status === CashRegisterStatus.CLOSED) {
          throw new BadRequestException(
            'No se puede modificar una venta de una caja cerrada',
          );
        }
      }

      // 2️⃣ Debe existir una caja abierta actual
      const currentRegister = await this.cashRegisterService.getCurrentForUser(
        sale.shopId,
        user.id,
      );

      if (!currentRegister) {
        throw new BadRequestException(
          'Debe haber una caja abierta para modificar la venta',
        );
      }

      // 3️⃣ Revertir stock e items si vienen nuevos
      if (dto.items) {
        for (const oldItem of sale.items) {
          const product = await manager.findOne(ShopProduct, {
            where: { id: oldItem.shopProductId },
          });

          if (product) {
            product.stock! += Number(oldItem.quantity);
            await manager.save(product);
          }

          await manager.remove(oldItem);
        }

        for (const item of dto.items) {
          const product = await manager.findOne(ShopProduct, {
            where: { id: item.shopProductId },
          });

          if (!product) {
            throw new BadRequestException(
              `Producto ${item.shopProductId} no encontrado`,
            );
          }

          const subtotal = Number(item.quantity) * item.unitPrice;
          const taxAmount = item.taxRate ? subtotal * item.taxRate : 0;

          const total = subtotal - (item.discount ?? 0) + taxAmount;

          await manager.save(
            manager.create(SaleItem, {
              sale,
              shopProduct: product,
              shopProductId: product.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
              discount: item.discount ?? 0,
              taxRate: item.taxRate ?? 0,
              taxAmount,
              total,
              priceWasModified: item.priceWasModified ?? false,
            }),
          );

          product.stock! -= Number(item.quantity);
          await manager.save(product);
        }
      }

      // 4️⃣ Update campos simples
      sale.customerId = dto.customerId ?? sale.customerId;
      sale.subtotal = dto.subtotal ?? sale.subtotal;
      sale.discountAmount = dto.discountAmount ?? sale.discountAmount;
      sale.taxAmount = dto.taxAmount ?? sale.taxAmount;
      sale.totalAmount = dto.totalAmount ?? sale.totalAmount;
      sale.invoiceType = dto.invoiceType ?? sale.invoiceType;
      sale.invoiceNumber = dto.invoiceNumber ?? sale.invoiceNumber;
      sale.notes = dto.notes ?? sale.notes;

      await manager.save(sale);

      // 5️⃣ Sync cash movement
      if (sale.cashMovement) {
        sale.cashMovement.amount = sale.totalAmount;
        await manager.save(sale.cashMovement);
      }

      await manager.save(
        manager.create(SaleHistory, {
          sale,
          action: SaleHistoryAction.UPDATED,
          userId: user.id,
        }),
      );

      return sale;
    });
  }

  // ─────────────────────────────────────────────
  // CANCEL SALE
  // ─────────────────────────────────────────────
  async cancel(id: string, dto: CancelSaleDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id },
        relations: ['items', 'cashMovement'],
      });

      if (!sale) {
        throw new BadRequestException('Venta no encontrada');
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException('La venta ya está cancelada');
      }

      // caja cerrada → no se toca
      if (sale.cashMovement?.cashRegisterId) {
        const register = await this.cashRegisterService.getById(
          sale.cashMovement.cashRegisterId,
        );

        if (register?.status === CashRegisterStatus.CLOSED) {
          throw new BadRequestException(
            'No se puede cancelar una venta de una caja cerrada',
          );
        }
      }

      // devolver stock
      for (const item of sale.items) {
        const product = await manager.findOne(ShopProduct, {
          where: { id: item.shopProductId },
        });

        if (product) {
          product.stock! += Number(item.quantity);
          await manager.save(product);
        }
      }

      // anular movimiento de caja
      if (sale.cashMovement) {
        await manager.remove(sale.cashMovement);
        sale.cashMovement = null;
      }

      sale.status = SaleStatus.CANCELLED;
      sale.paymentStatus = PaymentStatus.CANCELLED;
      sale.cancelledAt = new Date();
      sale.cancelledBy = user.id;
      sale.cancellationReason = dto.reason;

      await manager.save(sale);

      await manager.save(
        manager.create(SaleHistory, {
          sale,
          action: SaleHistoryAction.CANCELLED,
          userId: user.id,
        }),
      );

      return { message: 'Venta cancelada correctamente' };
    });
  }
}
