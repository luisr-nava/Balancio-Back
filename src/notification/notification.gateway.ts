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
import { Notification } from './entities/notification.entity';

/**
 * The payload sent over the wire on every "notification:new" event.
 *
 * Intentionally omits server-internal fields:
 *   - deduplicationKey  — implementation detail, meaningless to the client
 *   - userId            — the receiver already knows their own id
 */
export type WsNotificationPayload = Omit<
  Notification,
  'deduplicationKey' | 'userId'
>;

/** UUID v4 pattern — used to validate that a room name is a real userId. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Safely extracts a validated userId string from a decoded JWT object.
 *
 * jwt.verify() returns `string | JwtPayload`. Casting directly to a custom
 * interface silently swallows shape errors. This function validates the
 * return value structurally and returns `null` on any mismatch, so the
 * caller never touches an untrusted value.
 */
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

  // Reject empty strings and values that are not valid UUIDs.
  // Room names must be valid userIds — anything else is either a bug or an attack.
  if (!UUID_RE.test(userId)) {
    return null;
  }

  return userId;
}

/**
 * WebSocket gateway for real-time notification delivery.
 *
 * Namespace    : /notifications
 * Auth         : Access token sent in handshake.auth.token (verified on connect)
 * Room model   : Each userId is its own room; multi-tab users receive the event
 *                on every open socket simultaneously — Socket.io handles this for free.
 * Event emitted: "notification:new" with WsNotificationPayload
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    // Mirror the allowed origins from the HTTP server so dev (Vite :5173,
    // Next :3000/:3001) and prod environments behave consistently.
    origin: [
      process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
    ].filter(Boolean),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Called by Socket.io for every new connection.
   *
   * Returns Promise<void> so NestJS / Socket.io can await it.
   * The OnGatewayConnection interface declares handleConnection as returning
   * `any`, so returning a Promise is fully supported.
   *
   * ─── Why async instead of .catch() ────────────────────────────────────────
   * Socket.io's client.join() is typed as `void | Promise<void>`.
   * `.catch()` does not exist on `void`, so the previous code was a type
   * error. Making the method async and using `await` works for BOTH the
   * synchronous (void) and asynchronous (Promise<void>) overloads:
   *   - awaiting `void`           → resolves immediately as `undefined`
   *   - awaiting `Promise<void>`  → resolves when the room join completes
   * No type assertion, no `any`, no hacks.
   */
  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`Socket ${client.id} rejected: missing auth token`);
      client.disconnect();
      return;
    }

    let userId: string | null = null;

    try {
      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      // jwt.verify throws on expiry / bad signature — caught below.
      const raw = jwt.verify(token, secret);
      userId = extractUserId(raw);
    } catch {
      // Expired or tampered token.
      // No log at error level — this is a normal client-side event (token expiry).
      this.logger.warn(`Socket ${client.id} rejected: invalid or expired token`);
      client.disconnect();
      return;
    }

    if (!userId) {
      this.logger.warn(
        `Socket ${client.id} rejected: token missing a valid UUID sub claim`,
      );
      client.disconnect();
      return;
    }

    // ── Duplicate-join guard ─────────────────────────────────────────────────
    // client.rooms is a Set<string> maintained by Socket.io.
    // A socket starts in a room with its own ID (client.id) automatically.
    // If the same socket somehow calls handleConnection twice (e.g., a
    // Socket.io edge case during namespace re-connection), skip the join
    // instead of issuing a redundant one — Socket.io is idempotent here,
    // but being explicit makes intent clear and avoids unnecessary I/O.
    if (client.rooms.has(userId)) {
      this.logger.debug(
        `Socket ${client.id} already in room ${userId} — skipping join`,
      );
      return;
    }

    // ── Room join ────────────────────────────────────────────────────────────
    // await handles both void (sync) and Promise<void> (async) transparently.
    // The outer try/catch isolates a join failure from the JWT validation
    // path — two different failure modes, two different responses.
    try {
      await client.join(userId);
      this.logger.debug(`Socket ${client.id} joined room ${userId}`);
    } catch (err) {
      this.logger.error(
        `Socket ${client.id} failed to join room ${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
      client.disconnect();
    }
  }

  /**
   * Socket.io removes a disconnected socket from all rooms automatically.
   * Nothing to do here — logged at debug level for connection lifecycle tracing.
   */
  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  /**
   * Broadcasts a new notification to all sockets for the given user.
   *
   * The payload is trimmed to WsNotificationPayload — deduplicationKey and
   * userId are stripped before serialisation.
   */
  sendNotification(userId: string, notification: Notification): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deduplicationKey, userId: _uid, ...payload } = notification;

    this.server
      .to(userId)
      .emit('notification:new', payload satisfies WsNotificationPayload);
  }
}
