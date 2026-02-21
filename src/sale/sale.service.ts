import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { Between, DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
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
import { Customer } from '@/customer/entities/customer.entity';
import { MercadoPagoService } from './mercado-pago.service';
import { NotificationService } from '@/notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from '@/notification/entities/notification.entity';
import { User, UserRole } from '@/auth/entities/user.entity';

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
    private readonly mercadoPagoService: MercadoPagoService,

    private readonly notificationService: NotificationService,
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

      // 2️⃣ Calcular totales
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

      // 2.5️⃣ Validación FIADO (PENDING)
      if (dto.paymentStatus === PaymentStatus.PENDING) {
        if (!dto.customerId) {
          throw new BadRequestException('Una venta fiada requiere un cliente');
        }

        const customer = await manager.findOne(Customer, {
          where: { id: dto.customerId, shopId: dto.shopId },
        });

        if (!customer) {
          throw new BadRequestException('Cliente no encontrado');
        }

        const newBalance = Number(customer.currentBalance ?? 0) + saleTotal;

        // 👉 SOLO validar si tiene límite
        if (
          customer.creditLimit !== null &&
          customer.creditLimit !== undefined
        ) {
          if (newBalance > customer.creditLimit) {
            throw new BadRequestException(
              `Límite de crédito excedido. Disponible: ${
                customer.creditLimit - customer.currentBalance
              }`,
            );
          }
        }

        // Actualizar balance del cliente
        customer.currentBalance = newBalance;
        await manager.save(customer);
      }
      const paymentStatus = dto.paymentStatus ?? PaymentStatus.PAID;
      // 3️⃣ Crear venta
      const sale = manager.create(Sale, {
        shopId: dto.shopId,
        customerId: dto.customerId ?? null,
        employeeId: user.id,
        paymentMethodId: dto.paymentMethodId,
        subtotal: saleSubtotal,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: saleTaxAmount,
        totalAmount: saleTotal,
        paymentStatus,
        invoiceType: dto.invoiceType ?? null,
        invoiceNumber: dto.invoiceNumber ?? null,
        notes: dto.notes ?? null,
        status:
          paymentStatus === PaymentStatus.PAID
            ? SaleStatus.COMPLETED
            : SaleStatus.DRAFT,
        saleDate: dto.saleDate ? new Date(dto.saleDate) : new Date(),
      });

      await manager.save(sale);

      let shopUsers: User[] | null = null;
      // 4️⃣ Items + stock + history
      for (const item of dto.items) {
        const shopProduct = await manager.findOne(ShopProduct, {
          where: { id: item.shopProductId, shopId: dto.shopId },
          relations: {
            product: true,
          },
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
        const previousStock = shopProduct.stock ?? 0;

        if (previousStock < quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${shopProduct.product.name}. Disponible: ${previousStock}`,
          );
        }
        const result = await manager.decrement(
          ShopProduct,
          {
            id: shopProduct.id,
            stock: MoreThanOrEqual(quantity),
          },
          'stock',
          quantity,
        );

        if (result.affected === 0) {
          throw new BadRequestException(
            `Stock insuficiente para ${shopProduct.product.name}`,
          );
        }

        // 🔥 Volver a leer el stock actualizado
        const updatedProduct = await manager.findOne(ShopProduct, {
          where: { id: shopProduct.id },
          relations: { product: true },
        });

        if (!updatedProduct) {
          throw new BadRequestException(
            'Producto no encontrado tras actualizar',
          );
        }
        console.log('ANTES:', previousStock);
        console.log('CANTIDAD:', quantity);
        console.log('DESPUÉS:', shopProduct.stock);
        // item history
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
        if (previousStock > 5 && (updatedProduct.stock ?? 0) <= 5) {
          if (!shopUsers) {
            shopUsers = await manager.find(User, {
              relations: {
                userShops: true,
              },
              where: {
                userShops: {
                  shopId: dto.shopId,
                },
              },
            });
          }

          for (const u of shopUsers) {
            await this.notificationService.createNotification(
              {
                userId: u.id,
                shopId: dto.shopId,
                type: NotificationType.LOW_STOCK,
                message: `Producto ${shopProduct.product.name} bajo stock (${shopProduct.stock} unidades restantes)`,
                severity: NotificationSeverity.WARNING,
              },
              manager,
            );
          }
        }
      }

      if (paymentStatus === PaymentStatus.MP_PENDING) {
        const preference = await this.mercadoPagoService.createPreference(
          sale.id,
          `Venta ${sale.id}`,
          sale.totalAmount,
        );

        return {
          id: sale.id,
          totalAmount: sale.totalAmount,
          paymentStatus: sale.paymentStatus,
          mpInitPoint: preference.init_point,
        };
      }
      // 5️⃣ Cash movement SOLO si está paga
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

      // 6️⃣ Sale history (con snapshot obligatorio)
      await manager.save(
        manager.create(SaleHistory, {
          sale,
          saleId: sale.id,
          userId: user.id,
          action: SaleHistoryAction.CREATED,
          snapshot: {
            shopId: sale.shopId,
            customerId: sale.customerId,
            subtotal: sale.subtotal,
            taxAmount: sale.taxAmount,
            totalAmount: sale.totalAmount,
            paymentStatus: sale.paymentStatus,
            saleDate: sale.saleDate,
            items: dto.items,
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
      // solo sus ventas
      where.employeeId = user.id;
    }

    if (user.role === 'MANAGER') {
      // solo tiendas donde trabaja
      if (!user.shopIds || user.shopIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }

      where.shopId = filters.shopId ? filters.shopId : In(user.shopIds);
    }

    if (user.role === 'OWNER') {
      // todas las ventas del owner
      if (filters.shopId) {
        where.shopId = filters.shopId;
      }
      // si no hay shopId → ve todas
    }

    // 📅 RANGO DE FECHAS
    if (filters.fromDate && filters.toDate) {
      where.saleDate = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    const [sales, total] = await this.saleRepo.findAndCount({
      where,
      relations: {
        shop: true,
        customer: true,
        paymentMethod: true,
        items: {
          shopProduct: {
            product: true,
          },
        },
        history: true,
      },
      order: { saleDate: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: sales.map((sale) => ({
        id: sale.id,
        shop: sale.shop.name,
        customer: sale.customer?.fullName ?? null,
        paymentMethod: sale.paymentMethod.name,
        items: sale.items.map((item) => {
          const basePrice =
            item.shopProduct.salePrice ?? item.shopProduct.costPrice;

          return {
            id: item.id,
            product: item.shopProduct.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            basePrice,
            priceDifference: item.unitPrice - basePrice,
            total: item.total,
            priceWasModified: item.priceWasModified,
          };
        }),
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        status: sale.status,
        saleDate: sale.saleDate,
        notes: sale.notes,
        // history:
        //   sale.history
        //     ?.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        //     .map((h) => ({
        //       action: h.action,
        //       userId: h.userId,
        //       createdAt: h.createdAt,
        //       snapshot: h.snapshot,
        //     })) ?? [],
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────
  // UPDATE SALE
  // ─────────────────────────────────────────────
  async update(id: string, dto: UpdateSaleDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id },
        relations: {
          cashMovement: true, // 👈 SOLO ESTO
        },
      });

      if (!sale) {
        throw new BadRequestException('Venta no encontrada');
      }

      // 1️⃣ Venta de caja cerrada → NO editable
      if (sale.cashMovement?.cashRegisterId) {
        const register = await this.cashRegisterService.getById(
          sale.cashMovement.cashRegisterId,
        );

        if (register?.status === CashRegisterStatus.CLOSED) {
          throw new BadRequestException(
            'No se puede modificar una venta de una caja cerrada',
          );
        }
      }

      // 2️⃣ Caja abierta actual obligatoria
      const currentRegister = await this.cashRegisterService.getCurrentForUser(
        sale.shopId,
        user.id,
      );

      if (!currentRegister) {
        throw new BadRequestException(
          'Debe haber una caja abierta para modificar la venta',
        );
      }

      const previousTotal = Number(sale.totalAmount);
      const previousPaymentStatus = sale.paymentStatus;

      let subtotal = 0;
      let taxAmount = 0;
      let totalAmount = 0;

      // 3️⃣ Si vienen items → revertir stock + borrar items
      if (dto.items) {
        const oldItems = await manager.find(SaleItem, {
          where: { sale: { id: sale.id } },
        });

        for (const oldItem of oldItems) {
          const product = await manager.findOne(ShopProduct, {
            where: { id: oldItem.shopProductId },
          });

          if (product) {
            product.stock = (product.stock ?? 0) + Number(oldItem.quantity);
            await manager.save(product);
          }
        }

        await manager.delete(SaleItem, { sale: { id: sale.id } });

        // 4️⃣ Crear nuevos items
        for (const item of dto.items) {
          const product = await manager.findOne(ShopProduct, {
            where: { id: item.shopProductId, shopId: sale.shopId },
          });

          if (!product) {
            throw new BadRequestException(
              `Producto ${item.shopProductId} no encontrado`,
            );
          }

          const quantity = Number(item.quantity);
          const itemSubtotal = quantity * item.unitPrice;
          const itemTax = item.taxRate ? itemSubtotal * item.taxRate : 0;
          const itemDiscount = item.discount ?? 0;
          const itemTotal = itemSubtotal - itemDiscount + itemTax;

          subtotal += itemSubtotal;
          taxAmount += itemTax;
          totalAmount += itemTotal;

          await manager.save(
            manager.create(SaleItem, {
              sale: { id: sale.id }, // ✅ JAMÁS saleId
              shopProduct: { id: product.id },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: itemSubtotal,
              discount: itemDiscount,
              taxRate: item.taxRate ?? 0,
              taxAmount: itemTax,
              total: itemTotal,
              priceWasModified: item.priceWasModified ?? false,
            }),
          );

          product.stock = (product.stock ?? 0) - quantity;
          await manager.save(product);
        }

        sale.subtotal = subtotal;
        sale.taxAmount = taxAmount;
        sale.totalAmount = totalAmount;
      }

      // 5️⃣ Campos simples
      sale.customerId = dto.customerId ?? sale.customerId;
      sale.invoiceType = dto.invoiceType ?? sale.invoiceType;
      sale.invoiceNumber = dto.invoiceNumber ?? sale.invoiceNumber;
      sale.notes = dto.notes ?? sale.notes;
      sale.paymentStatus = dto.paymentStatus ?? sale.paymentStatus;

      await manager.save(sale); // ✅ ahora es seguro

      // 6️⃣ Lógica FIADO / balance cliente
      if (sale.customerId) {
        const customer = await manager.findOne(Customer, {
          where: { id: sale.customerId, shopId: sale.shopId },
        });

        if (!customer) {
          throw new BadRequestException('Cliente no encontrado');
        }

        // PENDING → PAID
        if (
          previousPaymentStatus === PaymentStatus.PENDING &&
          sale.paymentStatus === PaymentStatus.PAID
        ) {
          await manager.decrement(
            Customer,
            { id: customer.id },
            'currentBalance',
            previousTotal,
          );

          const movement = manager.create(CashMovement, {
            cashRegisterId: currentRegister.id,
            shopId: sale.shopId,
            userId: user.id,
            type: CashMovementType.INCOME,
            amount: sale.totalAmount,
            description: `Cobro venta fiada ${sale.id}`,
            saleId: sale.id,
          });

          await manager.save(movement);
          sale.cashMovement = movement;
          await manager.save(sale);
        }

        // sigue FIADO → ajustar diferencia
        if (
          previousPaymentStatus === PaymentStatus.PENDING &&
          sale.paymentStatus === PaymentStatus.PENDING
        ) {
          const diff = sale.totalAmount - previousTotal;

          if (diff !== 0) {
            if (customer.creditLimit != null) {
              const available =
                customer.creditLimit - (customer.currentBalance ?? 0);

              if (diff > available) {
                throw new BadRequestException(
                  'El ajuste supera el límite de crédito del cliente',
                );
              }
            }

            await manager.increment(
              Customer,
              { id: customer.id },
              'currentBalance',
              diff,
            );
          }
        }
      }

      // 7️⃣ Sync cash movement
      if (sale.cashMovement && sale.paymentStatus === PaymentStatus.PAID) {
        sale.cashMovement.amount = sale.totalAmount;
        await manager.save(sale.cashMovement);
      }

      return {
        id: sale.id,
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        updatedAt: new Date(),
      };
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
          saleId: sale.id,
          userId: user.id,
          action: SaleHistoryAction.CANCELLED,
          snapshot: {
            reason: dto.reason,
            cancelledAt: sale.cancelledAt,
            cancelledBy: user.id,
            previousStatus: SaleStatus.COMPLETED,
            previousPaymentStatus: sale.paymentStatus,
          },
        }),
      );

      // 🔔 Buscar usuarios vinculados a la tienda
      const users = await manager.find(User, {
        relations: {
          userShops: true,
        },
        where: {
          userShops: {
            shopId: sale.shopId,
          },
        },
      });

      // 🔐 Filtrar OWNER y MANAGER
      const recipients = users.filter((u) =>
        [UserRole.OWNER, UserRole.MANAGER].includes(u.role),
      );

      // 🔔 Crear notificación para cada uno
      for (const recipient of recipients) {
        await this.notificationService.createNotification(
          {
            userId: recipient.id,
            shopId: sale.shopId,
            type: NotificationType.SALE_CANCELED,
            message: `Venta ${sale.id} anulada por $${sale.totalAmount}`,
            severity: NotificationSeverity.INFO,
          },
          manager,
        );
      }

      return { message: 'Venta cancelada correctamente' };
    });
  }

  async markSaleAsPaidFromWebhook(saleId: string) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, { where: { id: saleId } });

      const cashRegister = await this.cashRegisterService.getCurrentForUser(
        sale!.shopId,
        sale!.employeeId!,
      );

      if (!cashRegister) {
        throw new BadRequestException(
          'No hay caja abierta para registrar el pago',
        );
      }
      if (!sale) throw new BadRequestException('Venta no encontrada');

      if (sale.paymentStatus === PaymentStatus.PAID) return;

      sale.paymentStatus = PaymentStatus.PAID;
      sale.status = SaleStatus.COMPLETED;

      await manager.save(sale);
      if (!sale.employeeId) {
        throw new BadRequestException('Venta sin empleado asociado');
      }
      const movement = manager.create(CashMovement, {
        cashRegisterId: cashRegister.id,
        shopId: sale.shopId,
        userId: sale.employeeId,
        type: CashMovementType.INCOME,
        amount: sale.totalAmount,
        description: `Pago MP venta ${sale.id}`,
        saleId: sale.id,
      });

      await manager.save(movement);
    });
  }
}
