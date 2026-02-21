import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import {
  Payment,
  PaymentsStatus,
  PaymentProvider,
} from './entities/payment.entity';
import { Sale, PaymentStatus, SaleStatus } from '@/sale/entities/sale.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';
import { Customer } from '@/customer/entities/customer.entity';

@Injectable()
export class PaymentService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
  ) {}

  // ─────────────────────────────────────────────
  // FINALIZAR PAGO MANUAL (CASH / CARD / TEST)
  // ─────────────────────────────────────────────
  async finalizePaymentBySaleId(saleId: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { saleId },
      });

      if (!payment) {
        throw new BadRequestException('Payment no encontrado');
      }

      return this.finalize(manager, payment);
    });
  }

  // ─────────────────────────────────────────────
  // WEBHOOK MERCADOPAGO
  // ─────────────────────────────────────────────
  async processMercadoPagoWebhook(providerPaymentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { providerPaymentId },
      });

      if (!payment) {
        throw new BadRequestException('Payment no encontrado');
      }

      if (payment.provider !== PaymentProvider.MERCADOPAGO) {
        throw new BadRequestException('Webhook inválido para este provider');
      }

      return this.finalize(manager, payment);
    });
  }

  // ─────────────────────────────────────────────
  // MÉTODO PRIVADO CENTRAL (NO ABRE TRANSACCIÓN)
  // ─────────────────────────────────────────────
  private async finalize(manager: EntityManager, payment: Payment) {
    // 🔁 Idempotencia
    if (payment.status === PaymentsStatus.APPROVED) {
      return { message: 'Payment ya estaba aprobado' };
    }

    const sale = await manager.findOne(Sale, {
      where: { id: payment.saleId },
    });

    if (!sale) {
      throw new BadRequestException('Venta no encontrada');
    }

    if (!payment.cashRegisterId) {
      throw new BadRequestException('Payment sin caja');
    }

    if (!sale.employeeId) {
      throw new BadRequestException('Venta sin empleado asignado');
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException(
        'No se puede finalizar una venta cancelada',
      );
    }

    if (sale.paymentStatus === PaymentStatus.PAID) {
      return { message: 'La venta ya estaba pagada' };
    }
    const previousPaymentStatus = sale.paymentStatus;

    // 1️⃣ Actualizar Payment
    payment.status = PaymentsStatus.APPROVED;
    await manager.save(payment);

    // 2️⃣ Actualizar Sale
    sale.paymentStatus = PaymentStatus.PAID;
    sale.status = SaleStatus.COMPLETED;
    await manager.save(sale);

    // 3️⃣ Si era FIADO → descontar deuda
    if (previousPaymentStatus === PaymentStatus.PENDING && sale.customerId) {
      await manager.decrement(
        Customer,
        { id: sale.customerId },
        'currentBalance',
        sale.totalAmount,
      );
    }

    // 4️⃣ Crear movimiento si no existe
    const existingMovement = await manager.findOne(CashMovement, {
      where: { saleId: sale.id },
    });

    if (!existingMovement) {
      const movement = manager.create(CashMovement, {
        cashRegisterId: payment.cashRegisterId,
        shopId: payment.shopId,
        userId: sale.employeeId,
        type: CashMovementType.INCOME,
        amount: Number(payment.amount),
        description: `Pago venta ${sale.id}`,
        saleId: sale.id,
      });

      await manager.save(movement);
    }

    return {
      saleId: sale.id,
      paymentStatus: payment.status,
    };
  }
}
