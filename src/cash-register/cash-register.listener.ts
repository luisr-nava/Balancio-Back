import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CashRegisterGateway } from './cash-register.gateway';
import { CashRegisterService } from './cash-register.service';
import {
  CASH_REGISTER_MOVEMENT_EVENT,
  CashMovementChangedPayload,
} from '@/cash-movement/cash-movement.service';
import {
  CASH_REGISTER_CLOSED_EVENT,
} from './cash-register.service';
import { CashRegisterLivePayload } from './cash-register.gateway';

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
    private readonly cashRegisterService: CashRegisterService,
    private readonly gateway: CashRegisterGateway,
  ) {}

  @OnEvent(CASH_REGISTER_MOVEMENT_EVENT)
  async handle(payload: CashMovementChangedPayload): Promise<void> {
    try {
      const liveData = await this.cashRegisterService.getRegisterLiveData(
        payload.cashRegisterId,
      );

      if (!liveData) return;

      this.gateway.emitLiveUpdate(payload.shopId, liveData);
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
