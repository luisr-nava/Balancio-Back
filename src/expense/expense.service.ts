import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { CashRegisterService } from '@/cash-register/cash-register.service';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';
import { JwtPayload } from 'jsonwebtoken';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashMovementService } from '@/cash-movement/cash-movement.service';
import { RealtimeEvents, RealtimeGateway } from '@/realtime/realtime.gateway';
import { UserShop } from '@/auth/entities/user-shop.entity';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    private readonly cashRegisterService: CashRegisterService,
    private readonly cashMovementService: CashMovementService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}
  async create(dto: CreateExpenseDto, user: JwtPayload) {
    // 1️⃣ Validar caja abierta DEL USUARIO
    const cashRegister = await this.cashRegisterService.getCurrentForUser(
      dto.shopId,
      user.id,
    );

    if (!cashRegister) {
      throw new BadRequestException(
        'Debes tener una caja abierta para registrar un gasto',
      );
    }

    // 2️⃣ Crear expense
    const expense = await this.expenseRepo.save(
      this.expenseRepo.create({
        shopId: dto.shopId,
        paymentMethodId: dto.paymentMethodId,
        amount: dto.amount,
        description: dto.description,
        category: dto.category,
        date: dto.date ? new Date(dto.date) : new Date(),
        createdBy: user.id,
      }),
    );

    // 3️⃣ Crear CashMovement (EXPENSE)
    const movement = await this.cashMovementService.create({
      cashRegisterId: cashRegister.id,
      shopId: dto.shopId,
      type: CashMovementType.EXPENSE,
      amount: dto.amount,
      userId: user.id,
      description: dto.description,
      expenseId: expense.id,
    });

    // 4️⃣ Link inverso (opcional pero recomendado)
    expense.cashMovement = movement;
    await this.expenseRepo.save(expense);

    this.realtimeGateway.emitToShop(
      dto.shopId,
      RealtimeEvents.EXPENSE_CREATED,
      { expenseId: expense.id, shopId: dto.shopId },
    );

    return { message: 'Egreso creado correctamente', expense: expense };
  }

  async update(id: string, dto: UpdateExpenseDto, user: JwtPayload) {
    // 1️⃣ Buscar expense con su movimiento
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: {
        cashMovement: true,
      },
    });

    if (!expense) {
      throw new BadRequestException('Egreso no encontrado');
    }

    // 2️⃣ Validar autor
    if (expense.createdBy !== user.id) {
      throw new BadRequestException(
        'No tienes permiso para modificar este egreso',
      );
    }

    // 3️⃣ Validar caja asociada
    if (!expense.cashMovement?.cashRegisterId) {
      throw new BadRequestException('El egreso no está asociado a una caja');
    }

    const cashRegister = await this.cashRegisterService.getById(
      expense.cashMovement.cashRegisterId,
    );

    if (!cashRegister) {
      throw new BadRequestException('Caja no encontrada');
    }

    // 🔒 REGLA CLAVE
    if (cashRegister.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede modificar un egreso de una caja cerrada',
      );
    }

    // 4️⃣ Update permitido (caja abierta)
    this.expenseRepo.merge(expense, {
      description: dto.description ?? expense.description,
      category: dto.category ?? expense.category,
      date: dto.date ? new Date(dto.date) : expense.date,
      amount: dto.amount ?? expense.amount,
    });

    // 🔁 si cambia el amount → actualizar cash movement
    if (
      dto.amount !== undefined &&
      expense.cashMovement.amount !== dto.amount
    ) {
      expense.cashMovement.amount = dto.amount;
      await this.cashMovementService.updateAmount(
        expense.cashMovement.id,
        dto.amount,
      );
    }

    await this.expenseRepo.save(expense);

    this.realtimeGateway.emitToShop(
      expense.shopId,
      RealtimeEvents.EXPENSE_UPDATED,
      { expenseId: expense.id, shopId: expense.shopId },
    );

    return {
      message: 'Egreso actualizado correctamente',
      expense,
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

    const where: FindOptionsWhere<Expense> = {};

    // 1️⃣ Filtro por tienda (obligatorio a nivel negocio)
    if (filters.shopId) {
      const userShop = await this.userShopRepo.findOne({
        where: { userId: user.id, shopId: filters.shopId },
      });
      if (!userShop) {
        throw new ForbiddenException('No tienes acceso a esta tienda');
      }
      where.shopId = filters.shopId;
    }

    // 2️⃣ Filtro por categoría
    if (filters.category) {
      where.category = filters.category;
    }

    // 3️⃣ Filtro por fechas
    if (filters.fromDate && filters.toDate) {
      where.date = Between(
        new Date(filters.fromDate),
        new Date(filters.toDate),
      );
    }

    // 4️⃣ Query paginada
    const [expenses, total] = await this.expenseRepo.findAndCount({
      where,
      relations: { paymentMethod: true },
      order: {
        date: 'DESC',
      },
      skip,
      take: limit,
    });

    return {
      data: expenses.map((expense) => ({
        id: expense.id,
        shopId: expense.shopId,
        paymentMethodId: expense.paymentMethodId,
        paymentMethod: expense.paymentMethod,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        createdBy: expense.createdBy,
      })),
      total,
    };
  }

  async remove(id: string, user: JwtPayload) {
    const expense = await this.expenseRepo.findOne({
      where: { id },
      relations: { cashMovement: true },
    });

    if (!expense) {
      throw new BadRequestException('Egreso no encontrado');
    }

    const userShop = await this.userShopRepo.findOne({
      where: { userId: user.id, shopId: expense.shopId },
    });

    if (!userShop) {
      throw new ForbiddenException('No tienes acceso a esta tienda');
    }

    if (expense.createdBy !== user.id && userShop.role === 'EMPLOYEE') {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este egreso',
      );
    }

    if (!expense.cashMovement?.cashRegisterId) {
      throw new BadRequestException('El egreso no está asociado a una caja');
    }

    const cashRegister = await this.cashRegisterService.getById(
      expense.cashMovement.cashRegisterId,
    );

    if (!cashRegister || cashRegister.status === 'CLOSED') {
      throw new BadRequestException(
        'No se puede eliminar un egreso de una caja cerrada',
      );
    }

    const movementId = expense.cashMovement.id;

    // 🔓 1️⃣ romper FK
    expense.cashMovement = null;
    await this.expenseRepo.save(expense);

    // 🔥 2️⃣ borrar movement
    await this.cashMovementService.remove(movementId);

    // 🧹 3️⃣ borrar expense
    await this.expenseRepo.remove(expense);

    this.realtimeGateway.emitToShop(
      expense.shopId,
      RealtimeEvents.EXPENSE_DELETED,
      { expenseId: expense.id, shopId: expense.shopId },
    );

    return { message: 'Egreso eliminado correctamente' };
  }
}
