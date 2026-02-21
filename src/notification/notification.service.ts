import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { UserNotificationPreference } from './entities/notification-preference.entity';
import { NotificationGateway } from './notification.gateway';

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
    const repo = manager
      ? manager.getRepository(UserNotificationPreference)
      : this.preferencesRepository;

    const notificationRepo = manager
      ? manager.getRepository(Notification)
      : this.notificationsRepository;

    // 🔎 Buscar preferencia del usuario
    const preference = await repo.findOne({
      where: {
        userId: data.userId,
        type: data.type,
      },
    });

    // ❌ Si existe y está desactivada → no crear
    if (preference && !preference.enabled) {
      return null;
    }

    // ✅ Crear normalmente
    const notification = notificationRepo.create(data);
    const saved = await notificationRepo.save(notification);

    // 🚀 Emitir en tiempo real
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
