import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMovement } from './entities/cash-movement.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Injectable()
export class CashMovementService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly repo: Repository<CashMovement>,
  ) {}

  async create(dto: CreateCashMovementDto) {
    // Validar que solo haya un sourceId
    const sourceIds = [
      dto.saleId,
      dto.purchaseId,
      dto.saleReturnId,
      dto.incomeId,
      dto.expenseId,
    ].filter(Boolean);

    if (sourceIds.length > 1) {
      throw new BadRequestException(
        'CashMovement solo puede estar asociado a una entidad',
      );
    }

    const movement = this.repo.create({
      cashRegisterId: dto.cashRegisterId,
      shopId: dto.shopId,
      type: dto.type,
      amount: dto.amount,
      userId: dto.userId,
      description: dto.description,
      saleId: dto.saleId,
      purchaseId: dto.purchaseId,
      saleReturnId: dto.saleReturnId,
      incomeId: dto.incomeId,
      expenseId: dto.expenseId,
    });

    return this.repo.save(movement);
  }

  async remove(id: string) {
    const movement = await this.repo.findOne({
      where: { id },
    });

    if (!movement) {
      throw new BadRequestException('Movimiento no encontrado');
    }

    await this.repo.remove(movement);
  }
  async updateAmount(id: string, amount: number) {
    await this.repo.update(id, { amount });
  }
}
