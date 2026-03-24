import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NOTIFICATION_EVENTS } from './constants/notification.events';

/**
 * Decoupled entry point for the event-driven notification path.
 *
 * Business modules (sale, cash-register, etc.) can emit
 * NOTIFICATION_EVENTS.CREATE without injecting NotificationService, which:
 *   - Eliminates circular dependency risk as the module graph grows
 *   - Keeps notification concerns isolated in this module
 *   - Allows easy future extension (push, email) by adding more @OnEvent handlers
 *
 * Usage in any service:
 *
 *   constructor(private readonly eventEmitter: EventEmitter2) {}
 *
 *   // After a transaction commits:
 *   await this.eventEmitter.emitAsync(NOTIFICATION_EVENTS.CREATE, {
 *     userId: recipient.id,
 *     type: NotificationType.SALE_CREATED,
 *     title: 'Nueva venta',
 *     message: `Venta por $${total}`,
 *     severity: NotificationSeverity.SUCCESS,
 *     metadata: { saleId, amount: total },
 *   } satisfies CreateNotificationDto);
 *
 * Note: EventEmitter2 is registered globally in AppModule via
 *   EventEmitterModule.forRoot({ wildcard: false, global: true })
 * so no additional import is needed in the emitting module.
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles NOTIFICATION_EVENTS.CREATE emitted by any module.
   *
   * Uses emitAsync-compatible @OnEvent — the emitter can await this handler
   * to know when the notification has been persisted.
   *
   * Error isolation: failures here are logged but never re-thrown so that
   * a notification failure never crashes the emitting business operation.
   */
  @OnEvent(NOTIFICATION_EVENTS.CREATE, { async: true })
  async handleCreate(dto: CreateNotificationDto): Promise<void> {
    try {
      await this.notificationService.createNotification(dto);
    } catch (err) {
      this.logger.error(
        `Failed to create notification (type=${dto.type}, userId=${dto.userId})`,
        err instanceof Error ? err.stack : err,
      );
      // Intentionally not re-thrown: a notification failure must never
      // propagate back and break the emitting business operation.
    }
  }
}
