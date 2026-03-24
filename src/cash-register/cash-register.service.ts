import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CashMovementType,
  CashRegister,
} from './entities/cash-register.entity';
import { Between, FindOptionsWhere, In, Repository } from 'typeorm';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CashRegisterStatus } from './enums/cash-register-status.enum';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { JwtPayload } from 'jsonwebtoken';
import { CashMovementService } from '@/cash-movement/cash-movement.service';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { ShopService } from '@/shop/shop.service';
import { NotificationService } from '@/notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from '@/notification/entities/notification.entity';
import { User, UserRole } from '@/auth/entities/user.entity';
import { CashRegisterLivePayload } from './cash-register.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const CASH_REGISTER_CLOSED_EVENT = 'cash-register.closed';

export interface LiveRegisterItem {
  registerId: string;
  status: CashRegisterStatus;
  employeeId: string;
  employeeName: string | null;
  currentAmount: number;
  totalMovements: number;
}

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);

  constructor(
    @InjectRepository(CashRegister)
    private readonly repo: Repository<CashRegister>,

    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    private readonly cashMovementService: CashMovementService,
    private readonly shopService: ShopService,
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  async open(dto: OpenCashRegisterDto, user: JwtPayload) {
    // 1️⃣ Validar que el usuario no tenga otra caja abierta (en ESA tienda)
    const existing = await this.repo.findOne({
      where: {
        shopId: dto.shopId,
        employeeId: user.id,
        status: CashRegisterStatus.OPEN,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Ya tienes una caja abierta en esta tienda',
      );
    }

    // 2️⃣ Crear la caja
    const cashRegister = await this.repo.save(
      this.repo.create({
        shopId: dto.shopId,
        employeeId: user.id,
        openingAmount: dto.openingAmount.toFixed(2),
        openedByUserId: user.id,
        openedByName: user.fullName,
        status: CashRegisterStatus.OPEN,
      }),
    );

    // 3️⃣ Crear movimiento OPENING
    await this.cashMovementService.create({
      cashRegisterId: cashRegister.id,
      shopId: dto.shopId,
      type: CashMovementType.OPENING,
      amount: dto.openingAmount,
      userId: user.id,
      description: 'Apertura de caja',
    });

    // 4️⃣ Notificar a OWNER y MANAGER de la tienda
    const shopUsers = await this.repo.manager.find(User, {
      relations: { userShops: true },
      where: { userShops: { shopId: dto.shopId } },
    });

    const recipients = shopUsers.filter((u) =>
      [UserRole.OWNER, UserRole.MANAGER].includes(u.role),
    );

    for (const recipient of recipients) {
      await this.notificationService.createNotification({
        userId: recipient.id,
        shopId: dto.shopId,
        type: NotificationType.CASH_OPENED,
        title: 'Caja abierta',
        message: `Caja abierta por ${user.fullName} con $${dto.openingAmount}`,
        severity: NotificationSeverity.INFO,
        metadata: { openingAmount: dto.openingAmount, openedBy: user.fullName },
      });
    }

    return {
      ...cashRegister,
      message: 'Caja abierta correctamente',
    };
  }

  async close(shopId: string, dto: CloseCashRegisterDto, user: JwtPayload) {
    // 1️⃣ Buscar caja ABIERTA del usuario en esa tienda
    const cashRegister = await this.repo.findOne({
      where: {
        shopId,
        employeeId: user.id,
        status: CashRegisterStatus.OPEN,
      },
    });

    if (!cashRegister) {
      throw new BadRequestException(
        'No tienes una caja abierta para cerrar en esta tienda',
      );
    }

    // 2️⃣ Traer movimientos de ESA caja
    const movements = await this.cashMovementRepo.find({
      where: {
        cashRegisterId: cashRegister.id,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    if (!movements.length) {
      throw new BadRequestException('La caja no tiene movimientos registrados');
    }

    // 3️⃣ Calcular monto esperado DESDE movimientos
    const expectedAmount = this.calculateExpectedAmount(movements);

    // 4️⃣ Calcular diferencia con lo que contó el usuario
    const difference = dto.actualAmount - expectedAmount;

    // 5️⃣ Cerrar caja
    Object.assign(cashRegister, {
      actualAmount: dto.actualAmount,
      closingAmount: expectedAmount,
      difference,
      closedAt: new Date(),
      closedBy: user.id,
      closingNotes: dto.closingNotes,
      status: CashRegisterStatus.CLOSED,
    });

    await this.repo.save(cashRegister);

    this.eventEmitter.emit(CASH_REGISTER_CLOSED_EVENT, {
      registerId: cashRegister.id,
      shopId,
      status: 'CLOSED',
      currentAmount: expectedAmount,
      totalMovements: movements.length,
      closingAmount: expectedAmount,
      actualAmount: dto.actualAmount,
      difference,
    } satisfies CashRegisterLivePayload);

    const users = await this.repo.manager.find(User, {
      relations: {
        userShops: true,
      },
      where: {
        userShops: {
          shopId,
        },
      },
    });

    // 🔐 Filtrar OWNER y MANAGER
    const recipients = users.filter((u) =>
      [UserRole.OWNER, UserRole.MANAGER].includes(u.role),
    );

    for (const recipient of recipients) {
      const isOwner = recipient.role === UserRole.OWNER;

      await this.notificationService.createNotification({
        userId: recipient.id,
        shopId,
        type: NotificationType.CASH_CLOSED,
        title: 'Caja cerrada',
        message: isOwner
          ? `Caja cerrada por ${user.fullName} - Total $${expectedAmount}. Puede descargar el reporte desde el panel.`
          : `Caja cerrada por ${user.fullName} - Total $${expectedAmount}`,
        severity: NotificationSeverity.INFO,
        metadata: {
          expectedAmount,
          closedBy: user.fullName,
          cashRegisterId: cashRegister.id,
        },
      });
    }

    return {
      message: 'Caja cerrada correctamente',
      cashRegister,
    };
  }

  async getAll(
    filters: {
      shopId?: string;
      status?: CashRegisterStatus;
      employeeId?: string;
      fromDate?: string;
      toDate?: string;
      onlyOpen?: string;
      page?: string;
      limit?: string;
    },
    user: JwtPayload,
  ) {
    const where: FindOptionsWhere<CashRegister> = {};

    const shopsResult = await this.shopService.getMyShops(user);
    const shopIds = shopsResult.data.map((shop) => shop.id);

    // 2️⃣ Permisos
    if (user.role === 'EMPLOYEE') {
      where.employeeId = user.id;
      where.shopId = In(shopIds);
    }

    if (user.role === 'MANAGER' || user.role === 'OWNER') {
      where.shopId = In(shopIds);
    }

    // 3️⃣ Filtros
    if (filters.shopId) {
      where.shopId = filters.shopId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.onlyOpen === 'true') {
      where.status = CashRegisterStatus.OPEN;
    }

    if (filters.employeeId && user.role !== 'EMPLOYEE') {
      where.employeeId = filters.employeeId;
    }

    if (filters.fromDate && filters.toDate) {
      where.openedAt = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    // 4️⃣ Paginación
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const skip = (page - 1) * limit;

    // 5️⃣ Query
    const [cashRegisters, total] = await this.repo.findAndCount({
      where,
      order: { openedAt: 'DESC' },
      skip,
      take: limit,
    });

    // 6️⃣ Data
    const data = await Promise.all(
      cashRegisters.map(async (cr) => {
        const movements = await this.cashMovementRepo.find({
          where: { cashRegisterId: cr.id },
        });

        return {
          id: cr.id,
          shopId: cr.shopId,
          employeeId: cr.employeeId,
          status: cr.status,
          openedAt: cr.openedAt,
          closedAt: cr.closedAt ?? null,
          openingAmount: Number(cr.openingAmount),
          expectedAmount: this.calculateExpectedAmount(movements),
          actualAmount: cr.actualAmount ? Number(cr.actualAmount) : null,
          difference: cr.difference ? Number(cr.difference) : null,
          movementsCount: movements.length,
        };
      }),
    );

    return {
      data,
      total,
    };
  }

  async getMovements(cashRegisterId: string, user: JwtPayload) {
    // 1️⃣ Buscar la caja
    const cashRegister = await this.repo.findOne({
      where: { id: cashRegisterId },
    });

    if (!cashRegister) {
      throw new BadRequestException('Caja no encontrada');
    }

    // 2️⃣ Traer movimientos
    const movements = await this.cashMovementRepo.find({
      where: { cashRegisterId },
      order: { createdAt: 'ASC' },
    });

    // 3️⃣ Calcular total esperado (parcial o final)
    const expectedAmount = this.calculateExpectedAmount(movements);

    // 4️⃣ Armar summary según estado
    const summary =
      cashRegister.status === CashRegisterStatus.OPEN
        ? {
            openingAmount: Number(cashRegister.openingAmount),
            expectedAmount,
            movementsCount: movements.length,
          }
        : {
            openingAmount: Number(cashRegister.openingAmount),
            expectedAmount: Number(cashRegister.closingAmount),
            countedAmount: Number(cashRegister.actualAmount),
            difference: Number(cashRegister.difference),
            status:
              cashRegister.difference === 0
                ? 'OK'
                : cashRegister.difference! < 0
                  ? 'SHORTAGE'
                  : 'SURPLUS',
            closedAt: cashRegister.closedAt,
          };

    return {
      cashRegister,
      movements,
      summary,
    };
  }

  async getCurrentForUser(shopId: string, userId: string) {
    return this.repo.findOne({
      where: {
        shopId,
        employeeId: userId,
        status: CashRegisterStatus.OPEN,
      },
      order: {
        openedAt: 'DESC',
      },
    });
  }

  async getCurrent(shopId: string) {
    return this.repo.findOne({
      where: {
        shopId,
        status: CashRegisterStatus.OPEN,
      },
      order: {
        openedAt: 'DESC',
      },
    });
  }

  private calculateExpectedAmount(movements: CashMovement[]): number {
    return movements.reduce((total, m) => {
      switch (m.type) {
        case CashMovementType.OPENING:
        case CashMovementType.SALE:
        case CashMovementType.INCOME:
        case CashMovementType.DEPOSIT:
          return total + m.amount;

        case CashMovementType.EXPENSE:
        case CashMovementType.PURCHASE:
        case CashMovementType.WITHDRAWAL:
          return total - m.amount;

        case CashMovementType.ADJUSTMENT:
          return total + m.amount;

        default:
          return total;
      }
    }, 0);
  }

  async getById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Returns all registers (OPEN + CLOSED) for a specific shop.
   * Includes employeeName from openedByName.
   *
   * OWNER / MANAGER → all registers for the shop
   * EMPLOYEE        → only their own registers
   */
  async getByShop(shopId: string, user: JwtPayload) {
    const shopsResult = await this.shopService.getMyShops(user);
    const allowedIds = shopsResult.data.map((s) => s.id);
    if (!allowedIds.includes(shopId)) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }

    const where: FindOptionsWhere<CashRegister> = { shopId };

    if (user.role === UserRole.EMPLOYEE) {
      where.employeeId = user.id;
    }

    const registers = await this.repo.find({
      where,
      order: { openedAt: 'DESC' },
    });

    return registers.map((cr) => ({
      id: cr.id,
      status: cr.status,
      openingAmount: Number(cr.openingAmount),
      closingAmount: cr.closingAmount ? Number(cr.closingAmount) : null,
      actualAmount: cr.actualAmount ? Number(cr.actualAmount) : null,
      difference: cr.difference ? Number(cr.difference) : null,
      openedAt: cr.openedAt,
      closedAt: cr.closedAt ?? null,
      employeeId: cr.employeeId,
      employeeName: cr.openedByName ?? null,
    }));
  }

  // ─── Live monitoring ────────────────────────────────────────────────────────

  /**
   * Returns all currently OPEN registers for a shop, each with a real-time
   * calculated currentAmount and movement count — single aggregation query,
   * no movement arrays loaded into memory.
   *
   * OWNER / MANAGER → all open registers for the shop
   * EMPLOYEE        → only their own register
   */
  async getLive(shopId: string, user: JwtPayload): Promise<LiveRegisterItem[]> {
    // Verify the caller has access to this shop
    const shopsResult = await this.shopService.getMyShops(user);
    const allowedIds = (shopsResult.data ?? []).map((s) => s.id);

    // DEBUG — remove after confirming values match
    this.logger.debug(
      `[getLive] shopId="${shopId}" role="${user.role}" userId="${user.id}" allowedIds=${JSON.stringify(allowedIds)}`,
    );

    if (!allowedIds.includes(shopId)) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }

    try {
      const qb = this.repo
        .createQueryBuilder('cr')
        .select('cr.id', 'registerId')
        .addSelect('cr.status', 'status')
        .addSelect('cr.employeeId', 'employeeId')
        .addSelect('cr.openedByName', 'employeeName')
        .addSelect(
          `COALESCE(SUM(CASE cm.type
              WHEN 'OPENING'    THEN cm.amount
              WHEN 'SALE'       THEN cm.amount
              WHEN 'INCOME'     THEN cm.amount
              WHEN 'DEPOSIT'    THEN cm.amount
              WHEN 'ADJUSTMENT' THEN cm.amount
              WHEN 'EXPENSE'    THEN -(cm.amount)
              WHEN 'PURCHASE'   THEN -(cm.amount)
              WHEN 'WITHDRAWAL' THEN -(cm.amount)
              ELSE 0
            END), 0)`,
          'currentAmount',
        )
        .addSelect('COUNT(cm.id)::int', 'totalMovements')
        .leftJoin(CashMovement, 'cm', 'cm.cashRegisterId = cr.id')
        .where('cr.shopId = :shopId', { shopId })
        .andWhere('cr.status = :status', { status: CashRegisterStatus.OPEN })
        .groupBy('cr.id')
        .addGroupBy('cr.employeeId')
        .addGroupBy('cr.openedByName')
        .addGroupBy('cr.status');

      if (user.role === UserRole.EMPLOYEE) {
        qb.andWhere('cr.employeeId = :userId', { userId: user.id });
      }

      const rows = await qb.getRawMany<{
        registerId: string;
        status: CashRegisterStatus;
        employeeId: string;
        employeeName: string | null;
        currentAmount: string;
        totalMovements: number;
      }>();

      // DEBUG — remove after confirming rows are returned
      this.logger.debug(
        `[getLive] raw rows returned: ${rows.length} — ${JSON.stringify(rows)}`,
      );

      return rows.map((r) => ({
        registerId: r.registerId ?? '',
        status: r.status,
        employeeId: r.employeeId ?? '',
        employeeName: r.employeeName ?? null,
        currentAmount: Number(r.currentAmount ?? 0),
        totalMovements: Number(r.totalMovements ?? 0),
      }));
    } catch (error) {
      this.logger.error(
        `[getLive] query FAILED for shop ${shopId} — returning empty list. Error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  /**
   * Returns the minimal live payload for a single register.
   * Used internally by CashRegisterListener to build WebSocket events.
   */
  async getRegisterLiveData(
    cashRegisterId: string,
  ): Promise<CashRegisterLivePayload | null> {
    try {
      const row = await this.repo
        .createQueryBuilder('cr')
        .select('cr.id', 'registerId')
        .addSelect('cr.shopId', 'shopId')
        .addSelect('cr.status', 'status')
        .addSelect(
          `COALESCE(SUM(CASE cm.type
              WHEN 'OPENING'    THEN cm.amount
              WHEN 'SALE'       THEN cm.amount
              WHEN 'INCOME'     THEN cm.amount
              WHEN 'DEPOSIT'    THEN cm.amount
              WHEN 'ADJUSTMENT' THEN cm.amount
              WHEN 'EXPENSE'    THEN -(cm.amount)
              WHEN 'PURCHASE'   THEN -(cm.amount)
              WHEN 'WITHDRAWAL' THEN -(cm.amount)
              ELSE 0
            END), 0)`,
          'currentAmount',
        )
        .addSelect('COUNT(cm.id)::int', 'totalMovements')
        .leftJoin(CashMovement, 'cm', 'cm.cashRegisterId = cr.id')
        .where('cr.id = :cashRegisterId', { cashRegisterId })
        .groupBy('cr.id')
        .addGroupBy('cr.shopId')
        .addGroupBy('cr.status')
        .getRawOne<{
          registerId: string;
          shopId: string;
          status: string;
          currentAmount: string;
          totalMovements: number;
        }>();

      if (!row) return null;

      return {
        registerId: row.registerId,
        shopId: row.shopId,
        status: row.status as 'OPEN' | 'CLOSED',
        currentAmount: Number(row.currentAmount ?? 0),
        totalMovements: Number(row.totalMovements ?? 0),
      };
    } catch (error) {
      this.logger.error(
        `getRegisterLiveData failed for register ${cashRegisterId} — returning null`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
