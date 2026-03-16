import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { UserNotificationPreference } from './entities/notification-preference.entity';
import { NotificationGateway } from './notification.gateway';

/** Ventana de deduplicación: 24 horas en ms */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationService {
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

    // 🔎 Verificar preferencia del usuario
    const preference = await prefRepo.findOne({
      where: { userId: data.userId, type: data.type },
    });

    // ❌ Preferencia desactivada → omitir
    if (preference && !preference.enabled) {
      return null;
    }

    // 🔁 Deduplicación: si se provee clave, verificar ventana de 24 h
    if (data.deduplicationKey) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS);

      const duplicate = await notificationRepo.findOne({
        where: {
          deduplicationKey: data.deduplicationKey,
          createdAt: MoreThan(since),
        },
      });

      if (duplicate) {
        return null;
      }
    }

    // ✅ Crear y persistir
    const notification = notificationRepo.create({
      ...data,
      deduplicationKey: data.deduplicationKey ?? null,
    });
    const saved = await notificationRepo.save(notification);

    // 🚀 Emitir en tiempo real vía WebSocket
    this.notificationGateway.sendNotification(data.userId, saved);

    return saved;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationsRepository.update(notificationId, {
      read: true,
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, read: false },
      { read: true },
    );
  }

  async getUserPreferences(userId: string) {
    // 1️⃣ Traer preferencias existentes
    const existing = await this.preferencesRepository.find({
      where: { userId },
    });

    // 2️⃣ Map rápido por type
    const map = new Map(existing.map((p) => [p.type, p.enabled]));

    // 3️⃣ Generar lista completa basada en NotificationType enum
    const allTypes = Object.values(NotificationType);

    return allTypes.map((type) => ({
      type,
      enabled: map.has(type) ? map.get(type) : true, // default true
    }));
  }

  async updateUserPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
  ) {
    let preference = await this.preferencesRepository.findOne({
      where: { userId, type },
    });

    if (!preference) {
      preference = this.preferencesRepository.create({
        userId,
        type,
        enabled,
      });
    } else {
      preference.enabled = enabled;
    }

    return this.preferencesRepository.save(preference);
  }
}
