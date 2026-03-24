import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMovement } from './entities/cash-movement.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Event emitted after any cash movement is created or its amount updated.
 * Consumed by CashRegisterListener to push real-time updates over WebSocket.
 */
export const CASH_REGISTER_MOVEMENT_EVENT = 'cash_register.movement_changed';

export interface CashMovementChangedPayload {
  cashRegisterId: string;
  shopId: string;
}

@Injectable()
export class CashMovementService {
  constructor(
    @InjectRepository(CashMovement)
    private readonly repo: Repository<CashMovement>,
    private readonly eventEmitter: EventEmitter2,
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

    const saved = await this.repo.save(movement);

    this.eventEmitter.emit(CASH_REGISTER_MOVEMENT_EVENT, {
      cashRegisterId: saved.cashRegisterId,
      shopId: saved.shopId,
    } satisfies CashMovementChangedPayload);

    return saved;
  }

  async remove(id: string) {
    const movement = await this.repo.findOne({
      where: { id },
    });

    if (!movement) {
      throw new BadRequestException('Movimiento no encontrado');
    }

    await this.repo.remove(movement);

    this.eventEmitter.emit(CASH_REGISTER_MOVEMENT_EVENT, {
      cashRegisterId: movement.cashRegisterId,
      shopId: movement.shopId,
    } satisfies CashMovementChangedPayload);
  }

  async updateAmount(id: string, amount: number) {
    // Load before updating so we have cashRegisterId/shopId for the event.
    const movement = await this.repo.findOne({ where: { id } });

    await this.repo.update(id, { amount });

    if (movement) {
      this.eventEmitter.emit(CASH_REGISTER_MOVEMENT_EVENT, {
        cashRegisterId: movement.cashRegisterId,
        shopId: movement.shopId,
      } satisfies CashMovementChangedPayload);
    }
  }
}
