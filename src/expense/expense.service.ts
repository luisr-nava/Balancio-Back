import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { Repository } from 'typeorm';
import { CashRegisterService } from '@/cash-register/cash-register.service';
import { CashMovementType } from '@/cash-register/entities/cash-register.entity';
import { JwtPayload } from 'jsonwebtoken';
import { CashMovement } from '@/cash-movement/entities/cash-movement.entity';
import { CashMovementService } from '@/cash-movement/cash-movement.service';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    private readonly cashRegisterService: CashRegisterService,
    private readonly cashMovementService: CashMovementService,
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

    return { message: 'Egreso creado correctamente', expense: expense };
  }

  findAll() {
    return `This action returns all expense`;
  }

  findOne(id: number) {
    return `This action returns a #${id} expense`;
  }

  update(id: number, updateExpenseDto: UpdateExpenseDto) {
    return `This action updates a #${id} expense`;
  }

  remove(id: number) {
    return `This action removes a #${id} expense`;
  }
}
