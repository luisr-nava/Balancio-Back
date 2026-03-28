import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import {
  Between,
  DataSource,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
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
import { MercadoPagoService } from './mercado-pago.service';
import { NotificationService } from '@/notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from '@/notification/entities/notification.entity';
import { User, UserRole } from '@/auth/entities/user.entity';
import { ReceiptService } from './receipt/receipt.service';
import { Shop } from '@/shop/entities/shop.entity';
import { ReceiptPdfFactory } from './receipt/pdf/receipt-pdf.factory';
import {
  CustomerAccountMovement,
  CustomerAccountMovementType,
} from '@/customer-account/entities/customer-account-movement.entity';
import { CustomerShop } from '@/customer-account/entities/customer-shop.entity';
import { CustomerAccountService } from '@/customer-account/customer-account.service';

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
    private readonly receiptService: ReceiptService,
    private readonly customerAccountService: CustomerAccountService,
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

      // 2.5️⃣ Determinar paymentStatus e isOnCredit antes de persistir la venta
      const isOnCredit = dto.isOnCredit === true;
      if (isOnCredit) {
        dto.paymentStatus = PaymentStatus.PENDING;
      }

      if ((dto.paymentStatus === PaymentStatus.PENDING || isOnCredit) && !dto.customerId) {
        throw new BadRequestException('Una venta fiada requiere un cliente');
      }

      const paymentStatus = dto.paymentStatus ?? PaymentStatus.PAID;

      // 3️⃣ Crear y persistir venta (finalTotal queda inmutable desde este momento)
      const sale = manager.create(Sale, {
        shopId: dto.shopId,
        customerId: dto.customerId ?? null,
        employeeId: user.id,
        paymentMethodId: dto.paymentMethodId,
        subtotal: saleSubtotal,
        discountAmount: dto.discountAmount ?? 0,
        taxAmount: saleTaxAmount,
        totalAmount: saleTotal,
        finalTotal: saleTotal,
        paymentStatus,
        isOnCredit,
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

      // 3.1️⃣ Validación y actualización de cuenta corriente (FIADO)
      // Reads sale.finalTotal from the persisted row — never a recomputed local variable
      const immutableTotal = Number(sale.finalTotal ?? sale.totalAmount);

      if (paymentStatus === PaymentStatus.PENDING || isOnCredit) {
        // pessimistic_write lock — prevents concurrent debt races for the same customer+shop
        let customerShop = await manager.findOne(CustomerShop, {
          where: { customerId: dto.customerId!, shopId: dto.shopId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!customerShop) {
          customerShop = manager.create(CustomerShop, {
            customerId: dto.customerId!,
            shopId: dto.shopId,
            creditLimit: 0,
            currentDebt: 0,
            isBlocked: false,
          });
          await manager.save(customerShop);
        }

        if (customerShop.isBlocked) {
          throw new BadRequestException(
            'El cliente está bloqueado y no puede realizar compras a crédito',
          );
        }

        const newDebt = Number(customerShop.currentDebt) + immutableTotal;

        // Validate credit limit only when one is set (> 0)
        if (customerShop.creditLimit > 0 && newDebt > customerShop.creditLimit) {
          throw new BadRequestException(
            `Límite de crédito excedido. Disponible: $${(
              customerShop.creditLimit - Number(customerShop.currentDebt)
            ).toFixed(2)}`,
          );
        }

        // Task 4 — safe default: currentDebt never goes below 0
        customerShop.currentDebt = Math.max(0, newDebt);
        await manager.save(customerShop);
      }

      // 3.2️⃣ Movimiento de cuenta corriente DEBT + integrity check
      if (paymentStatus === PaymentStatus.PENDING && dto.customerId) {
        await manager.save(
          manager.create(CustomerAccountMovement, {
            customerId: dto.customerId,
            shopId: dto.shopId,
            type: CustomerAccountMovementType.DEBT,
            amount: immutableTotal,
            description: `Venta a crédito`,
            referenceId: sale.id,
            createdBy: user.id,
          }),
        );

        // Non-blocking integrity check — logs mismatch, never throws
        await this.customerAccountService.validateCustomerDebt(
          dto.customerId,
          dto.shopId,
          manager,
        );
      }

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
        const updatedStock = updatedProduct.stock ?? 0;

        if (previousStock > 5 && updatedStock <= 5) {
          if (!shopUsers) {
            shopUsers = await manager.find(User, {
              relations: { userShops: true },
              where: { userShops: { shopId: dto.shopId } },
            });
          }

          // Fecha local para la clave de deduplicación (evita duplicados el mismo día)
          const today = new Date().toISOString().split('T')[0];

          for (const u of shopUsers) {
            await this.notificationService.createNotification(
              {
                userId: u.id,
                shopId: dto.shopId,
                type: NotificationType.LOW_STOCK,
                title: 'Stock bajo',
                message: `${shopProduct.product.name} tiene ${updatedStock} unidades restantes`,
                severity: NotificationSeverity.WARNING,
                metadata: {
                  shopProductId: shopProduct.id,
                  productName: shopProduct.product.name,
                  remainingStock: updatedStock,
                },
                deduplicationKey: `LOW_STOCK:${shopProduct.id}:${u.id}:${today}`,
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

      // 7️⃣ Notify OWNER and MANAGER about the new sale
      const notificationRecipients =
        shopUsers ??
        (await manager.find(User, {
          relations: { userShops: true },
          where: { userShops: { shopId: dto.shopId } },
        }));

      for (const recipient of notificationRecipients.filter((u) =>
        [UserRole.OWNER, UserRole.MANAGER].includes(u.role),
      )) {
        await this.notificationService.createNotification(
          {
            userId: recipient.id,
            shopId: dto.shopId,
            type: NotificationType.SALE_CREATED,
            title: 'Nueva venta registrada',
            message: `Venta por $${Number(sale.totalAmount).toFixed(2)} registrada`,
            severity: NotificationSeverity.SUCCESS,
            metadata: {
              saleId: sale.id,
              amount: sale.totalAmount,
              paymentStatus: sale.paymentStatus,
            },
          },
          manager,
        );
      }

      // 🔒 Generar Receipt DESPUÉS de tener los items creados

      // 🔁 Recargar la venta con relaciones

      const shop = await manager.findOne(Shop, {
        where: { id: dto.shopId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!shop) {
        throw new BadRequestException('Shop not found');
      }

      const receiptNumber = shop.receiptSequence;
      shop.receiptSequence += 1;
      await manager.save(shop);

      // 🔁 Recargar venta con items reales
      const saleWithItems = await manager.findOne(Sale, {
        where: { id: sale.id },
        relations: {
          items: {
            shopProduct: {
              product: true,
            },
          },
        },
      });

      if (!saleWithItems) {
        throw new BadRequestException('Sale not found after creation');
      }

      const receipt = await this.receiptService.createReceipt(
        manager,
        saleWithItems,
        shop,
        receiptNumber,
        dto.paperSize,
      );

      const pdfBuffer = await ReceiptPdfFactory.create(
        receipt.paperSize,
      ).generate(receipt.snapshot);

      const receiptBase64 = pdfBuffer.toString('base64');

      return {
        saleId: sale.id,
        totalAmount: sale.totalAmount,
        paymentStatus: sale.paymentStatus,
        saleDate: sale.saleDate,
        receipt: receiptBase64,
      };
    });
  }

  async getAll(
    filters: {
      shopId?: string;
      customerId?: string;
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

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    // 📅 RANGO DE FECHAS
    if (filters.fromDate && filters.toDate) {
      where.saleDate = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    } else if (filters.fromDate) {
      where.saleDate = MoreThanOrEqual(new Date(filters.fromDate));
    } else if (filters.toDate) {
      where.saleDate = LessThanOrEqual(new Date(filters.toDate));
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
  // GET BY ID
  // ─────────────────────────────────────────────
  async getById(id: string, user: JwtPayload) {
    const where: any = { id };

    // 🔐 VISIBILIDAD POR ROL
    if (user.role === 'EMPLOYEE') {
      where.employeeId = user.id;
    }

    if (user.role === 'MANAGER') {
      if (!user.shopIds || user.shopIds.length === 0) {
        throw new BadRequestException('No tiene acceso a ninguna tienda');
      }
      where.shopId = In(user.shopIds);
    }

    const sale = await this.saleRepo.findOne({
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
      },
    });

    if (!sale) {
      throw new BadRequestException('Venta no encontrada');
    }

    return {
      id: sale.id,
      shopId: sale.shopId,
      shop: sale.shop.name,
      customerId: sale.customerId,
      customer: sale.customer?.fullName ?? null,
      paymentMethodId: sale.paymentMethodId,
      paymentMethod: sale.paymentMethod.name,
      items: sale.items.map((item) => ({
        id: item.id,
        shopProductId: item.shopProductId,
        product: item.shopProduct.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        priceWasModified: item.priceWasModified,
      })),
      subtotal: sale.subtotal,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      paymentStatus: sale.paymentStatus,
      status: sale.status,
      saleDate: sale.saleDate,
      notes: sale.notes,
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

      // 6️⃣ Lógica FIADO / cuenta corriente
      // Covers both isOnCredit=true and legacy PENDING sales
      if (sale.customerId && previousPaymentStatus === PaymentStatus.PENDING) {
        // pessimistic_write lock — prevents concurrent debt races for the same customer+shop
        const customerShop = await manager.findOne(CustomerShop, {
          where: { customerId: sale.customerId, shopId: sale.shopId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!customerShop) {
          // Legacy sale without CustomerShop record — skip debt update
          return {
            id: sale.id,
            totalAmount: sale.totalAmount,
            paymentStatus: sale.paymentStatus,
            updatedAt: new Date(),
          };
        }

        // PENDING → PAID: collect payment, reduce debt, create cash movement
        if (
          previousPaymentStatus === PaymentStatus.PENDING &&
          sale.paymentStatus === PaymentStatus.PAID
        ) {
          customerShop.currentDebt = Math.max(
            0,
            Number(customerShop.currentDebt) - previousTotal,
          );

          // Auto-unblock when debt returns within limit
          if (
            customerShop.isBlocked &&
            (customerShop.creditLimit === 0 ||
              customerShop.currentDebt <= customerShop.creditLimit)
          ) {
            customerShop.isBlocked = false;
          }

          await manager.save(customerShop);

          // Ledger entry: debt settled via sale update
          await manager.save(
            manager.create(CustomerAccountMovement, {
              customerId: sale.customerId,
              shopId: sale.shopId,
              type: CustomerAccountMovementType.PAYMENT,
              amount: previousTotal,
              description: `Cobro venta fiada ${sale.id}`,
              referenceId: sale.id,
              createdBy: user.id,
            }),
          );

          const cashMovement = manager.create(CashMovement, {
            cashRegisterId: currentRegister.id,
            shopId: sale.shopId,
            userId: user.id,
            type: CashMovementType.INCOME,
            amount: sale.totalAmount,
            description: `Cobro venta fiada ${sale.id}`,
            saleId: sale.id,
          });

          await manager.save(cashMovement);
          sale.cashMovement = cashMovement;
          await manager.save(sale);
        }

        // Still PENDING → adjust debt difference
        if (
          previousPaymentStatus === PaymentStatus.PENDING &&
          sale.paymentStatus === PaymentStatus.PENDING
        ) {
          const diff = sale.totalAmount - previousTotal;

          if (diff !== 0) {
            if (customerShop.creditLimit > 0 && diff > 0) {
              const available =
                customerShop.creditLimit - Number(customerShop.currentDebt);

              if (diff > available) {
                throw new BadRequestException(
                  'El ajuste supera el límite de crédito del cliente',
                );
              }
            }

            customerShop.currentDebt = Math.max(
              0,
              Number(customerShop.currentDebt) + diff,
            );

            // Auto-block if over limit after adjustment
            if (
              customerShop.creditLimit > 0 &&
              customerShop.currentDebt > customerShop.creditLimit
            ) {
              customerShop.isBlocked = true;
            }

            await manager.save(customerShop);
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

      // Capture before mutation so snapshot is accurate
      const previousStatus = sale.status;
      const previousPaymentStatus = sale.paymentStatus;

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

      // Revertir deuda en cuenta corriente si era venta a crédito pendiente
      if (sale.customerId && sale.paymentStatus === PaymentStatus.PENDING) {
        // pessimistic_write lock — prevents concurrent debt races for the same customer+shop
        const customerShop = await manager.findOne(CustomerShop, {
          where: { customerId: sale.customerId, shopId: sale.shopId },
          lock: { mode: 'pessimistic_write' },
        });

        if (customerShop) {
          const reversed = Math.min(
            Number(sale.totalAmount),
            Number(customerShop.currentDebt),
          );

          // Task 4 — safe default: currentDebt never goes below 0
          customerShop.currentDebt = Math.max(
            0,
            Number(customerShop.currentDebt) - reversed,
          );

          // Auto-unblock when debt returns within limit
          if (
            customerShop.isBlocked &&
            (customerShop.creditLimit === 0 ||
              customerShop.currentDebt <= customerShop.creditLimit)
          ) {
            customerShop.isBlocked = false;
          }

          await manager.save(customerShop);

          // Ledger reversal entry
          await manager.save(
            manager.create(CustomerAccountMovement, {
              customerId: sale.customerId,
              shopId: sale.shopId,
              type: CustomerAccountMovementType.PAYMENT,
              amount: reversed,
              description: `Cancelación de venta ${sale.id}`,
              referenceId: sale.id,
              createdBy: user.id,
            }),
          );

          // Non-blocking integrity check — logs mismatch, never throws
          await this.customerAccountService.validateCustomerDebt(
            sale.customerId,
            sale.shopId,
            manager,
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
            previousStatus,
            previousPaymentStatus,
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
            title: 'Venta anulada',
            message: `Venta anulada por $${sale.totalAmount}`,
            severity: NotificationSeverity.INFO,
            metadata: { saleId: sale.id, amount: sale.totalAmount },
          },
          manager,
        );
      }

      return { message: 'Venta cancelada correctamente' };
    });
  }

  async markSaleAsPaidFromWebhook(saleId: string) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id: saleId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sale) throw new BadRequestException('Venta no encontrada');

      const cashRegister = await this.cashRegisterService.getCurrentForUser(
        sale.shopId,
        sale.employeeId!,
      );

      if (!cashRegister) {
        throw new BadRequestException(
          'No hay caja abierta para registrar el pago',
        );
      }

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
