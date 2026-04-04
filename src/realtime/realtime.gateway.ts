import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User } from '@/auth/entities/user.entity';

export enum RealtimeEvents {
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  SALE_CREATED = 'sale.created',
  SALE_UPDATED = 'sale.updated',
  SALE_CANCELLED = 'sale.cancelled',
  PROMOTION_CREATED = 'promotion.created',
  PROMOTION_UPDATED = 'promotion.updated',
  PROMOTION_DELETED = 'promotion.deleted',
  PURCHASE_CREATED = 'purchase.created',
  PURCHASE_UPDATED = 'purchase.updated',
  PURCHASE_CANCELLED = 'purchase.cancelled',
  INCOME_CREATED = 'income.created',
  INCOME_UPDATED = 'income.updated',
  INCOME_DELETED = 'income.deleted',
  EXPENSE_CREATED = 'expense.created',
  EXPENSE_UPDATED = 'expense.updated',
  EXPENSE_DELETED = 'expense.deleted',
  CASH_CLOSED = 'cash.closed',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
}

export interface ProductRealtimePayload {
  productId: string;
  shopId: string;
  shopProductId: string;
}

export interface SaleRealtimePayload {
  saleId: string;
  shopId: string;
}

function extractHandshakeShopId(rawShopId: unknown): string | null {
  if (typeof rawShopId === 'string') {
    const shopId = rawShopId.trim();
    return shopId || null;
  }

  if (typeof rawShopId === 'number' && Number.isFinite(rawShopId)) {
    return String(rawShopId);
  }

  if (Array.isArray(rawShopId)) {
    for (const value of rawShopId) {
      const shopId = extractHandshakeShopId(value);
      if (shopId) {
        return shopId;
      }
    }
  }

  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractUserId(raw: unknown): string | null {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('sub' in raw) ||
    typeof (raw as Record<string, unknown>).sub !== 'string'
  ) {
    return null;
  }

  const userId = (raw as Record<string, string>).sub;

  if (!UUID_RE.test(userId)) {
    return null;
  }

  return userId;
}

function extractShopId(client: Socket): string | null {
  return (
    extractHandshakeShopId(client.handshake.auth?.shopId) ??
    extractHandshakeShopId(client.handshake.query.shopId)
  );
}

function getShopRoom(shopId: string): string {
  return `shop_${shopId}`;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    const requestedShopId = extractShopId(client);

    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: missing auth token`);
      client.disconnect();
      return;
    }

    let userId: string | null = null;

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const raw = jwt.verify(token, secret);
      userId = extractUserId(raw);
    } catch {
      this.logger.warn(
        `Socket ${client.id} rejected: invalid or expired token`,
      );
      client.disconnect();
      return;
    }

    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} rejected: token missing valid UUID sub claim`,
      );
      client.disconnect();
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      this.logger.warn(
        `Socket ${client.id} rejected: user not found or inactive`,
      );
      client.disconnect();
      return;
    }

    if (!requestedShopId) {
      this.logger.warn(`Socket ${client.id} rejected: invalid shopId`);
      client.disconnect();
      return;
    }

    const userShop = await this.userShopRepo.findOne({
      where: { userId, shopId: requestedShopId },
    });

    if (!userShop) {
      this.logger.warn(
        `Socket ${client.id} rejected: no access to shop ${requestedShopId}`,
      );
      client.disconnect();
      return;
    }

    const shopRoom = getShopRoom(requestedShopId);

    if (process.env['NODE_ENV'] !== 'production') {
      this.logger.debug(
        `Socket ${client.id} validated access to shop ${requestedShopId}`,
      );
    }

    try {
      await client.join(shopRoom);

      if (process.env['NODE_ENV'] !== 'production') {
        this.logger.debug(
          `Socket ${client.id} joined realtime room ${shopRoom}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Socket ${client.id} failed to join realtime room ${shopRoom}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    if (process.env['NODE_ENV'] !== 'production') {
      this.logger.debug(
        `Socket ${client.id} disconnected from realtime gateway`,
      );
    }
  }

  emitToShop<T>(shopId: string, event: RealtimeEvents, payload?: T): void {
    if (!shopId) {
      return;
    }

    const shopRoom = getShopRoom(shopId);

    try {
      if (payload === undefined) {
        this.server.to(shopRoom).emit(event);
        return;
      }

      this.server.to(shopRoom).emit(event, payload);
    } catch (error) {
      this.logger.warn(
        `Failed to emit realtime event ${event} to shop ${shopRoom}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
