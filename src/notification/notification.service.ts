import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { UserNotificationPreference } from './entities/notification-preference.entity';
import { NotificationGateway } from './notification.gateway';

/** Deduplication window: 24 hours in ms */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
}

export interface UserPreference {
  type: NotificationType;
  enabled: boolean;
  threshold?: number | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(UserNotificationPreference)
    private readonly preferencesRepository: Repository<UserNotificationPreference>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async createNotification(
    data: CreateNotificationDto,
    manager?: EntityManager,
  ): Promise<Notification | null> {
    const prefRepo = manager
      ? manager.getRepository(UserNotificationPreference)
      : this.preferencesRepository;

    const notificationRepo = manager
      ? manager.getRepository(Notification)
      : this.notificationsRepository;

    // Skip silently if the user has disabled this notification type
    const preference = await prefRepo.findOne({
      where: { userId: data.userId, type: data.type },
      select: { enabled: true },
    });

    if (preference && !preference.enabled) {
      return null;
    }

    // Deduplication: reject if the same key was created within the last 24 h.
    // The partial index on deduplicationKey makes this lookup fast.
    if (data.deduplicationKey) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS);

      const duplicate = await notificationRepo.findOne({
        where: {
          deduplicationKey: data.deduplicationKey,
          createdAt: MoreThan(since),
        },
        select: { id: true },
      });

      if (duplicate) {
        return null;
      }
    }

    // Grouping: if groupKey is provided, try to aggregate with existing notification
    if (data.groupKey) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await notificationRepo.findOne({
        where: {
          userId: data.userId,
          groupKey: data.groupKey,
          createdAt: MoreThan(today),
        },
      });

      if (existing) {
        // Aggregate: increment count and update metadata
        const existingMetadata = (existing.metadata as Record<string, unknown>) ?? {};
        const newMetadata = data.metadata ?? {};
        const existingTotal = Number(existingMetadata.total) || 0;
        const newAmount = Number(newMetadata.amount) || 0;

        existing.count += 1;
        existing.metadata = {
          ...existingMetadata,
          total: existingTotal + newAmount,
        };

        const saved = await notificationRepo.save(existing);

        try {
          this.notificationGateway.sendNotification(data.userId, saved);
        } catch (err) {
          this.logger.error(
            `WebSocket emit failed for user ${data.userId}`,
            err instanceof Error ? err.stack : err,
          );
        }

        return saved;
      }
    }

    const notification = notificationRepo.create({
      userId: data.userId,
      shopId: data.shopId ?? null,
      type: data.type,
      title: data.title,
      message: data.message,
      severity: data.severity,
      metadata: data.metadata ?? null,
      deduplicationKey: data.deduplicationKey ?? null,
      groupKey: data.groupKey ?? null,
    });

    const saved = await notificationRepo.save(notification);

    // ─── Real-time delivery ────────────────────────────────────────────────────
    // Isolated in its own try/catch: a WebSocket failure must NEVER propagate
    // to the caller and rollback a database transaction.
    //
    // ⚠️ Phantom-notification risk: when called with a `manager` (inside a DB
    // transaction), the WS emit fires before the transaction commits. If the
    // outer transaction later rolls back, the client sees a notification that
    // was never persisted. Mitigation: callers that trigger notifications inside
    // long transactions should emit NOTIFICATION_EVENTS.CREATE via EventEmitter2
    // AFTER the transaction resolves, so the event fires post-commit.
    try {
      this.notificationGateway.sendNotification(data.userId, saved);
    } catch (err) {
      this.logger.error(
        `WebSocket emit failed for user ${data.userId}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return saved;
  }

  async getUserNotifications(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotifications> {
    const { page, limit, isRead, type, shopId } = query;
    const skip = (page - 1) * limit;

    // QueryBuilder gives us dynamic WHERE clauses with predictable SQL and
    // a single getManyAndCount() call (one query, no N+1).
    const qb = this.notificationsRepository
      .createQueryBuilder('n')
      .where('n."userId" = :userId', { userId })
      // Composite index (userId, createdAt) covers this ordering efficiently
      .orderBy('n."createdAt"', 'DESC')
      .take(limit)
      .skip(skip);

    if (isRead !== undefined) {
      // Uses (userId, isRead) composite index when no other filters are present
      qb.andWhere('n."isRead" = :isRead', { isRead });
    }

    if (type !== undefined) {
      // Uses (userId, type, createdAt) composite index
      qb.andWhere('n."type" = :type', { type });
    }

    if (shopId !== undefined) {
      // Uses (userId, shopId, createdAt) composite index
      qb.andWhere('n."shopId" = :shopId', { shopId });
    }

    try {
      const [data, total] = await qb.getManyAndCount();
      return { data, total, page };
    } catch (error) {
      this.logger.error(
        'getUserNotifications query failed — returning empty list',
        error instanceof Error ? error.stack : String(error),
      );
      return { data: [], total: 0, page };
    }
  }

  /**
   * Marks a single notification as read.
   * The `userId` filter enforces ownership — only the notification's owner
   * can mark it as read. Without this, any authenticated user could mutate
   * any notification by guessing its UUID.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationsRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Notification ${notificationId} not found or does not belong to you`,
      );
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      // Uses the (userId, isRead) composite index — no full scan
      return await this.notificationsRepository.count({
        where: { userId, isRead: false },
      });
    } catch (error) {
      this.logger.error(
        'getUnreadCount query failed — returning 0',
        error instanceof Error ? error.stack : String(error),
      );
      return 0;
    }
  }

  async getUserPreferences(userId: string): Promise<UserPreference[]> {
    const existing = await this.preferencesRepository.find({
      where: { userId },
      select: { type: true, enabled: true, threshold: true },
    });

    const map = new Map(
      existing.map((p) => [p.type, { enabled: p.enabled, threshold: p.threshold }]),
    );
    const allTypes = Object.values(NotificationType);

    // ?? true: if the user has no saved preference for a type, default to enabled.
    // This also correctly narrows the return type to boolean (not boolean | undefined).
    return allTypes.map((type) => ({
      type,
      enabled: map.get(type)?.enabled ?? true,
      threshold: map.get(type)?.threshold ?? null,
    }));
  }

  /**
   * Upsert-based preference update.
   *
   * The previous read-modify-write (findOne → save) had a race condition:
   * two concurrent requests both observe no existing row and both try to
   * INSERT → unique constraint error on (userId, type).
   *
   * TypeORM's upsert() generates an INSERT … ON CONFLICT DO UPDATE, which
   * is a single atomic DB operation with no race.
   */
  async updateUserPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
    threshold?: number | null,
  ): Promise<UserPreference> {
    const data: { userId: string; type: NotificationType; enabled: boolean; threshold?: number | null } = {
      userId,
      type,
      enabled,
    };

    if (threshold !== undefined) {
      data.threshold = threshold;
    }

    await this.preferencesRepository.upsert(data, {
      conflictPaths: ['userId', 'type'],
      skipUpdateIfNoValuesChanged: true,
    });

    // Return the canonical state after upsert
    return { type, enabled, threshold: threshold ?? null };
  }

  async batchUpdateUserPreferences(
    userId: string,
    preferences: Array<{ type: NotificationType; enabled: boolean; threshold?: number | null }>,
  ): Promise<UserPreference[]> {
    const results: UserPreference[] = [];

    for (const pref of preferences) {
      const data: { userId: string; type: NotificationType; enabled: boolean; threshold?: number | null } = {
        userId,
        type: pref.type,
        enabled: pref.enabled,
      };

      if (pref.threshold !== undefined) {
        data.threshold = pref.threshold;
      }

      await this.preferencesRepository.upsert(data, {
        conflictPaths: ['userId', 'type'],
        skipUpdateIfNoValuesChanged: true,
      });

      results.push({ type: pref.type, enabled: pref.enabled, threshold: pref.threshold ?? null });
    }

    return results;
  }
}
