import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { Income } from './entities/income.entity';
import { CashRegisterService } from '@/cash-register/cash-register.service';
import { CashMovementService } from '@/cash-movement/cash-movement.service';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Income)
    private readonly incomeRepo: Repository<Income>,

    private readonly cashRegisterService: CashRegisterService,
    private readonly cashMovementService: CashMovementService,
  ) {}
  async create(dto: CreateIncomeDto, user: JwtPayload) {
    // 1️⃣ Validar caja abierta
    const cashRegister = await this.cashRegisterService.getCurrentForUser(
      dto.shopId,
      user.id,
    );

    if (!cashRegister) {
      throw new BadRequestException(
        'Debes tener una caja abierta para registrar un ingreso',
      );
    }

    // 2️⃣ Crear income
    const income = await this.incomeRepo.save(
      this.incomeRepo.create({
        shopId: dto.shopId,
        paymentMethodId: dto.paymentMethodId,
        amount: dto.amount,
        description: dto.description,
        category: dto.category,
        date: dto.date ? new Date(dto.date) : new Date(),
        createdBy: user.id,
      }),
    );

    // 3️⃣ Crear CashMovement (INCOME)
    const movement = await this.cashMovementService.create({
      cashRegisterId: cashRegister.id,
      shopId: dto.shopId,
      type: CashMovementType.INCOME,
      amount: dto.amount,
      userId: user.id,
      description: dto.description,
      incomeId: income.id,
    });

    // 4️⃣ Link inverso
    income.cashMovement = movement;
    await this.incomeRepo.save(income);

    return {
      message: 'Ingreso creado correctamente',
      income,
    };
  }
  async update(id: string, dto: UpdateIncomeDto, user: JwtPayload) {
    const income = await this.incomeRepo.findOne({
      where: { id },
      relations: {
        cashMovement: true,
      },
    });

    if (!income) {
      throw new BadRequestException('Ingreso no encontrado');
    }

    if (income.createdBy !== user.id) {
      throw new BadRequestException(
        'No tienes permiso para modificar este ingreso',
      );
    }

    if (!income.cashMovement?.cashRegisterId) {
      throw new BadRequestException('El ingreso no está asociado a una caja');
    }

    const cashRegister = await this.cashRegisterService.getById(
      income.cashMovement.cashRegisterId,
    );

    if (!cashRegister || cashRegister.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede modificar un ingreso de una caja cerrada',
      );
    }

    this.incomeRepo.merge(income, {
      description: dto.description ?? income.description,
      category: dto.category ?? income.category,
      date: dto.date ? new Date(dto.date) : income.date,
      amount: dto.amount ?? income.amount,
    });

    if (dto.amount !== undefined && income.cashMovement.amount !== dto.amount) {
      await this.cashMovementService.updateAmount(
        income.cashMovement.id,
        dto.amount,
      );
    }

    await this.incomeRepo.save(income);

    return {
      message: 'Ingreso actualizado correctamente',
      income,
    };
  }
  async getAll(
    filters: {
      shopId?: string;
      fromDate?: string;
      toDate?: string;
      category?: string;
      page?: string;
      limit?: string;
    },
    user: JwtPayload,
  ) {
    const page = Number(filters.page ?? 1);
    const limit = Number(filters.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Income> = {};

    if (filters.shopId) {
      where.shopId = filters.shopId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.fromDate && filters.toDate) {
      where.date = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    const [incomes, total] = await this.incomeRepo.findAndCount({
      where,
      order: { date: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: incomes,
      total,
    };
  }
  async remove(id: string, user: JwtPayload) {
    const income = await this.incomeRepo.findOne({
      where: { id },
      relations: {
        cashMovement: true,
      },
    });

    if (!income) {
      throw new BadRequestException('Ingreso no encontrado');
    }

    if (income.createdBy !== user.id) {
      throw new BadRequestException(
        'No tienes permiso para eliminar este ingreso',
      );
    }

    const cashRegister = await this.cashRegisterService.getById(
      income.cashMovement?.cashRegisterId ?? '',
    );

    if (!cashRegister || cashRegister.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede eliminar un ingreso de una caja cerrada',
      );
    }

    if (!income.cashMovement) {
      throw new BadRequestException(
        'El ingreso no está asociado a un movimiento de caja',
      );
    }
    const movementId = income.cashMovement.id;

    income.cashMovement = null;
    await this.incomeRepo.save(income);

    await this.cashMovementService.remove(movementId);
    await this.incomeRepo.remove(income);

    return { message: 'Ingreso eliminado correctamente' };
  }
}
