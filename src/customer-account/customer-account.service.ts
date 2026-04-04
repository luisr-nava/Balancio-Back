import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  CustomerAccountMovement,
  CustomerAccountMovementType,
} from './entities/customer-account-movement.entity';
import { CustomerShop } from './entities/customer-shop.entity';
import { Customer } from '@/customer/entities/customer.entity';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';
import { CashRegisterService } from '@/cash-register/cash-register.service';
import { PayCustomerAccountDto } from './dto/pay-customer-account.dto';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class CustomerAccountService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CustomerAccountMovement)
    private readonly movementRepo: Repository<CustomerAccountMovement>,
    @InjectRepository(CustomerShop)
    private readonly customerShopRepo: Repository<CustomerShop>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    private readonly cashRegisterService: CashRegisterService,
  ) {}

  // ── POST /customer-account/pay ──────────────────────────────────────────────

  async pay(dto: PayCustomerAccountDto, user: JwtPayload) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validate open cash register
      const cashRegister = await this.cashRegisterService.getCurrentForUser(
        dto.shopId,
        user.id,
      );

      if (!cashRegister) {
        throw new BadRequestException(
          'Debe haber una caja abierta para registrar un pago',
        );
      }

      // 2. Fetch CustomerShop record (pessimistic_write prevents concurrent debt races)
      const customerShop = await manager.findOne(CustomerShop, {
        where: { customerId: dto.customerId, shopId: dto.shopId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!customerShop) {
        throw new NotFoundException(
          'No se encontró la cuenta corriente del cliente en esta tienda',
        );
      }

      if (customerShop.currentDebt <= 0) {
        throw new BadRequestException('El cliente no tiene deuda pendiente');
      }

      if (dto.amount > customerShop.currentDebt) {
        throw new BadRequestException(
          `El monto excede la deuda actual ($${customerShop.currentDebt.toFixed(2)})`,
        );
      }

      // 3. Update CustomerShop debt
      customerShop.currentDebt = Math.max(
        0,
        Number(customerShop.currentDebt) - dto.amount,
      );

      // Auto-unblock when debt returns within limit or is fully paid
      if (customerShop.isBlocked) {
        const withinLimit =
          customerShop.creditLimit === 0 ||
          customerShop.currentDebt <= customerShop.creditLimit;

        if (withinLimit) {
          customerShop.isBlocked = false;
        }
      }

      await manager.save(customerShop);

      // 4. Create CustomerAccountMovement (PAYMENT)
      await manager.save(
        manager.create(CustomerAccountMovement, {
          customerId: dto.customerId,
          shopId: dto.shopId,
          type: CustomerAccountMovementType.PAYMENT,
          amount: dto.amount,
          description: dto.description ?? `Pago cuenta corriente`,
          createdBy: user.id,
        }),
      );

      // 5. Create CashMovement INCOME for the cash register
      await manager.save(
        manager.create(CashMovement, {
          cashRegisterId: cashRegister.id,
          shopId: dto.shopId,
          userId: user.id,
          type: CashMovementType.INCOME,
          amount: dto.amount,
          description:
            dto.description ??
            `Cobro cuenta corriente — ${customerShop.customer?.fullName ?? 'Cliente'}`,
        }),
      );

      // Non-blocking integrity check — logs mismatch, never throws
      await this.validateCustomerDebt(dto.customerId, dto.shopId, manager);

      return {
        message: 'Pago registrado correctamente',
        amountPaid: dto.amount,
        remainingDebt: customerShop.currentDebt,
      };
    });
  }

  // ── GET /customer-account/debtors ───────────────────────────────────────────

  async getDebtors(params: {
    shopId: string;
    search?: string;
    minDebt?: number;
    maxDebt?: number;
    isBlocked?: boolean;
    debtStatus?: 'pending' | 'paid';
    page?: number;
    limit?: number;
  }) {
    const {
      shopId,
      search,
      minDebt,
      maxDebt,
      isBlocked,
      debtStatus,
      page = 1,
      limit = 20,
    } = params;

    // Shared filter logic applied to any query builder
    const applyFilters = (
      qb: SelectQueryBuilder<CustomerShop>,
    ): SelectQueryBuilder<CustomerShop> => {
      if (search) {
        qb.andWhere('(c.fullName ILIKE :search OR c.phone LIKE :search)', {
          search: `%${search}%`,
        });
      }
      if (minDebt !== undefined) {
        qb.andWhere('cs.currentDebt >= :minDebt', { minDebt });
      }
      if (maxDebt !== undefined) {
        qb.andWhere('cs.currentDebt <= :maxDebt', { maxDebt });
      }
      if (isBlocked !== undefined) {
        qb.andWhere('cs.isBlocked = :isBlocked', { isBlocked });
      }
      if (debtStatus === 'pending') {
        qb.andWhere('cs.currentDebt > 0');
      } else if (debtStatus === 'paid') {
        qb.andWhere('cs.currentDebt = 0');
      }
      return qb;
    };

    // Paginated results — leftJoinAndSelect loads customer relation
    const dataQb = applyFilters(
      this.customerShopRepo
        .createQueryBuilder('cs')
        .leftJoinAndSelect('cs.customer', 'c')
        .where('cs.shopId = :shopId', { shopId })
        .andWhere('cs.currentDebt >= 0'),
    );
    const [accounts, total] = await dataQb
      .orderBy('cs.currentDebt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Total debt across ALL matching records (aggregate — leftJoin, no select of relation columns)
    const sumQb = applyFilters(
      this.customerShopRepo
        .createQueryBuilder('cs')
        .leftJoin('cs.customer', 'c')
        .select('COALESCE(SUM(cs.currentDebt), 0)', 'totalDebt')
        .where('cs.shopId = :shopId', { shopId })
        .andWhere('cs.currentDebt >= 0'),
    );
    const sumResult = await sumQb.getRawOne<{ totalDebt: string }>();
    const totalDebt = Number(sumResult?.totalDebt ?? 0);

    const data = accounts.map((cs) => ({
      customerId: cs.customerId,
      fullName: cs.customer?.fullName ?? 'Desconocido',
      phone: cs.customer?.phone ?? null,
      email: cs.customer?.email ?? null,
      currentDebt: cs.currentDebt,
      creditLimit: cs.creditLimit ?? 0,
      isBlocked: cs.isBlocked,
    }));

    return { data, total, totalDebt: Number(totalDebt) };
  }

  // ── PATCH /customer-account/:customerId/:shopId/block ───────────────────────

  async blockCustomer(customerId: string, shopId: string) {
    const customerShop = await this.customerShopRepo.findOne({
      where: { customerId, shopId },
    });

    if (!customerShop) {
      throw new NotFoundException(
        'No se encontró la cuenta corriente del cliente en esta tienda',
      );
    }

    if (customerShop.isBlocked) {
      throw new BadRequestException('El cliente ya está bloqueado');
    }

    customerShop.isBlocked = true;
    await this.customerShopRepo.save(customerShop);

    return { message: 'Cliente bloqueado correctamente' };
  }

  // ── PATCH /customer-account/:customerId/:shopId/unblock ──────────────────────

  async unblockCustomer(customerId: string, shopId: string) {
    const customerShop = await this.customerShopRepo.findOne({
      where: { customerId, shopId },
    });

    if (!customerShop) {
      throw new NotFoundException(
        'No se encontró la cuenta corriente del cliente en esta tienda',
      );
    }

    if (!customerShop.isBlocked) {
      throw new BadRequestException('El cliente no está bloqueado');
    }

    customerShop.isBlocked = false;
    await this.customerShopRepo.save(customerShop);

    return { message: 'Cliente desbloqueado correctamente' };
  }

  // ── INTEGRITY CHECK ──────────────────────────────────────────────────────────

  /**
   * Recomputes expected debt from the movement ledger and compares it against
   * CustomerShop.currentDebt. Never throws — only logs on mismatch.
   *
   * Pass `manager` when calling from inside an existing transaction so the
   * check reads the same transactional snapshot as the writes that preceded it.
   */
  async validateCustomerDebt(
    customerId: string,
    shopId: string,
    manager?: EntityManager,
  ): Promise<void> {
    try {
      const em = manager ?? this.dataSource.manager;

      // SUM(DEBT) - SUM(PAYMENT) should equal currentDebt
      const totalResult = await em
        .createQueryBuilder(CustomerAccountMovement, 'm')
        .select(
          `COALESCE(SUM(CASE WHEN m.type = 'DEBT' THEN m.amount ELSE -m.amount END), 0)`,
          'total',
        )
        .where('m.customerId = :customerId', { customerId })
        .andWhere('m.shopId = :shopId', { shopId })
        .getRawOne<{ total: string }>();
      const total = Number(totalResult?.total ?? 0);

      const account = await em
        .getRepository(CustomerShop)
        .findOne({ where: { customerId, shopId } });

      if (!account) return;

      const expected = Number(total);
      const actual = Number(account.currentDebt);

      // Allow 1-cent floating-point tolerance
      if (Math.abs(expected - actual) > 0.01) {
        console.error('[CustomerAccount] Debt mismatch detected', {
          customerId,
          shopId,
          expected,
          actual,
          diff: expected - actual,
        });
      }
    } catch (err) {
      console.error('[CustomerAccount] validateCustomerDebt failed', err);
    }
  }

  // ── GET /customer-account/movements ─────────────────────────────────────────

  async getMovements(params: {
    shopId: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    page: number;
    limit: number;
  }) {
    const { shopId, customerId, fromDate, toDate, page, limit } = params;

    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.customer', 'c')
      .where('m.shopId = :shopId', { shopId })
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (customerId) {
      qb.andWhere('m.customerId = :customerId', { customerId });
    }

    if (fromDate) {
      qb.andWhere('m.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    }

    if (toDate) {
      qb.andWhere('m.createdAt <= :toDate', {
        toDate: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
      });
    }

    const [movements, total] = await qb.getManyAndCount();

    return {
      data: movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount,
        description: m.description ?? null,
        referenceId: m.referenceId ?? null,
        customerId: m.customerId,
        customerName: m.customer?.fullName ?? 'Desconocido',
        createdAt: m.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── GET /customer-account/:customerId/:shopId ───────────────────────────────

  async getStatement(customerId: string, shopId: string) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const customerShop = await this.customerShopRepo.findOne({
      where: { customerId, shopId },
    });

    const movements = await this.movementRepo.find({
      where: { customerId, shopId },
      order: { createdAt: 'DESC' },
    });

    return {
      customerId: customer.id,
      fullName: customer.fullName,
      currentDebt: customerShop?.currentDebt ?? 0,
      creditLimit: customerShop?.creditLimit ?? 0,
      isBlocked: customerShop?.isBlocked ?? false,
      movements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: m.amount,
        description: m.description ?? null,
        referenceId: m.referenceId ?? null,
        createdBy: m.createdBy ?? null,
        createdAt: m.createdAt,
      })),
    };
  }
}
