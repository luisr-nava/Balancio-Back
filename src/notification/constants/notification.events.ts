/**
 * Event name constants for the notification event bus.
 *
 * Any module can emit NOTIFICATION_EVENTS.CREATE (via EventEmitter2) to
 * trigger a notification without injecting NotificationService directly.
 * This breaks the direct coupling between business modules and the
 * notification subsystem.
 *
 * ─── Event flow ──────────────────────────────────────────────────────────────
 *
 *   Business service  →  eventEmitter.emitAsync(NOTIFICATION_EVENTS.CREATE, dto)
 *         │
 *         ▼
 *   NotificationListener.handleCreate(dto)
 *         │
 *         ▼
 *   NotificationService.createNotification(dto)  → DB save + WS emit
 *
 * ─── Transaction safety ──────────────────────────────────────────────────────
 *
 *   IMPORTANT: emit AFTER the transaction resolves (not inside the callback).
 *   Emitting inside a transaction means the listener fires before commit,
 *   which can produce phantom notifications if the transaction later rolls back.
 *
 *   ✅ Correct:
 *     await dataSource.transaction(async (manager) => { ... });
 *     await eventEmitter.emitAsync(NOTIFICATION_EVENTS.CREATE, dto);
 *
 *   ❌ Incorrect (phantom risk):
 *     await dataSource.transaction(async (manager) => {
 *       ...
 *       await eventEmitter.emitAsync(NOTIFICATION_EVENTS.CREATE, dto);  // inside tx
 *     });
 *
 *   For notifications that MUST be part of a transaction (i.e., rolled back
 *   together with the parent entity), pass the EntityManager directly to
 *   NotificationService.createNotification(dto, manager) instead.
 */
export const NOTIFICATION_EVENTS = {
  /** Trigger notification creation. Payload: CreateNotificationDto */
  CREATE: 'notification.create',

  /**
   * Fired AFTER a notification is successfully persisted.
   * Useful for downstream side effects (analytics, push, email).
   * Payload: CreateNotificationDto
   */
  CREATED: 'notification.created',
} as const;

export type NotificationEventName =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
