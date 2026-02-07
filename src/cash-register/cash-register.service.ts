import { BadRequestException, Injectable } from '@nestjs/common';
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
@Injectable()
export class CashRegisterService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly repo: Repository<CashRegister>,

    @InjectRepository(CashMovement)
    private readonly cashMovementRepo: Repository<CashMovement>,
    private readonly cashMovementService: CashMovementService,
    private readonly shopService: ShopService,
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
      amount: dto.openingAmount, // puede ser 0
      userId: user.id,
      description: 'Apertura de caja',
    });

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

    return this.repo.save(cashRegister);
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
}
