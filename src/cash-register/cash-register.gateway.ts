import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

/**
 * Payload emitted on every "cash-register.updated" event.
 * Defined here so service and listener can import it without circular deps.
 */
export interface CashRegisterLivePayload {
  registerId: string;
  shopId: string;
  status: 'OPEN' | 'CLOSED';
  currentAmount: number;
  totalMovements: number;
  /** Populated only when status === 'CLOSED' */
  closingAmount?: number;
  actualAmount?: number;
  difference?: number;
}

/**
 * WebSocket gateway for real-time cash register monitoring.
 *
 * Namespace : /cash-register
 * Auth      : JWT in handshake.auth.token  +  shopId in handshake.auth.shopId
 * Room model: each shopId is one room — all subscribers for that shop receive every update.
 * Event     : "cash-register.updated" with CashRegisterLivePayload
 */
@WebSocketGateway({
  namespace: '/cash-register',
  cors: {
    origin: [
      process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ].filter(Boolean),
    credentials: true,
  },
})
export class CashRegisterGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CashRegisterGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    const shopId = client.handshake.auth?.shopId as string | undefined;

    if (!token || !shopId) {
      this.logger.warn(
        `[CashRegisterGateway] Socket ${client.id} rejected: missing token or shopId`,
      );
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      jwt.verify(token, secret);
    } catch {
      this.logger.warn(
        `[CashRegisterGateway] Socket ${client.id} rejected: invalid or expired token`,
      );
      client.disconnect();
      return;
    }

    try {
      await client.join(shopId);
      this.logger.debug(
        `[CashRegisterGateway] Socket ${client.id} joined room ${shopId}`,
      );
    } catch (err) {
      this.logger.error(
        `[CashRegisterGateway] Socket ${client.id} failed to join room ${shopId}`,
        err instanceof Error ? err.stack : String(err),
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`[CashRegisterGateway] Socket ${client.id} disconnected`);
  }

  /**
   * Broadcasts a live update to every socket currently watching the given shop.
   */
  emitLiveUpdate(shopId: string, payload: CashRegisterLivePayload): void {
    this.server.to(shopId).emit('cash-register.updated', payload);
  }
}
