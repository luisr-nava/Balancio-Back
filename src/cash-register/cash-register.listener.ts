import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CashRegisterGateway } from './cash-register.gateway';
import { CashRegisterService } from './cash-register.service';
import {
  CASH_REGISTER_MOVEMENT_EVENT,
  CashMovementChangedPayload,
} from '@/cash-movement/cash-movement.service';
import { CASH_REGISTER_CLOSED_EVENT } from './cash-register.service';
import { CashRegisterLivePayload } from './cash-register.gateway';
import { CashRegister } from './entities/cash-register.entity';
import { CashRegisterStatus } from './enums/cash-register-status.enum';

/**
 * Listens for cash movement events emitted by CashMovementService and
 * triggers a real-time WebSocket broadcast to the relevant shop room.
 *
 * Decoupled via EventEmitter so CashMovementService has zero knowledge
 * of this module — no circular dependency.
 */
@Injectable()
export class CashRegisterListener {
  private readonly logger = new Logger(CashRegisterListener.name);

  constructor(
    @InjectRepository(CashRegister)
    private readonly repo: Repository<CashRegister>,
    private readonly cashRegisterService: CashRegisterService,
    private readonly gateway: CashRegisterGateway,
  ) {}

  @OnEvent(CASH_REGISTER_MOVEMENT_EVENT)
  async handle(payload: CashMovementChangedPayload): Promise<void> {
    try {
      const register = await this.repo.findOne({
        where: { id: payload.cashRegisterId },
      });
      const liveData = await this.cashRegisterService.getRegisterLiveData(
        payload.cashRegisterId,
      );

      if (!register) return;

      if (!liveData) {
        const fallbackPayload: CashRegisterLivePayload = {
          registerId: register.id,
          shopId: register.shopId,
          status: register.status === CashRegisterStatus.OPEN ? 'OPEN' : 'CLOSED',
          currentAmount: Number(register.openingAmount),
          totalMovements: 1,
        };
        this.gateway.emitLiveUpdate(register.shopId, fallbackPayload);
        return;
      }

      const fullPayload = {
        registerId: register.id,
        shopId: register.shopId,
        status: liveData.status,
        employeeId: register.employeeId,
        openedByName: register.openedByName ?? null,
        currentAmount: liveData.currentAmount,
        totalMovements: liveData.totalMovements,
      };

      this.gateway.emitLiveUpdate(register.shopId, fullPayload);
    } catch (err) {
      this.logger.error(
        `Failed to emit live update for register ${payload.cashRegisterId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnEvent(CASH_REGISTER_CLOSED_EVENT)
  handleClosed(payload: CashRegisterLivePayload): void {
    this.gateway.emitLiveUpdate(payload.shopId, payload);
  }
}
