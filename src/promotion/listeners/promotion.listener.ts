import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserShop, UserShopRole } from '@/auth/entities/user-shop.entity';
import { User, UserRole } from '@/auth/entities/user.entity';
import { NotificationService } from '@/notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from '@/notification/entities/notification.entity';
import { PromotionCreatedEvent } from '../events/promotion-created.event';

@Injectable()
export class PromotionListener {
  private readonly logger = new Logger(PromotionListener.name);

  constructor(
    @InjectRepository(UserShop)
    private readonly userShopRepo: Repository<UserShop>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('promotion.created', { async: true })
  async handlePromotionCreated(event: PromotionCreatedEvent): Promise<void> {
    try {
      if (!event.shopIds.length) return;

      const rolesToNotify = this.getRolesToNotify(event.createdByRole);

      // Find all UserShop records that:
      // - belong to one of the promotion's shops
      // - have a role that should be notified
      // - are NOT the creator
      const userShops = await this.userShopRepo.find({
        where: {
          shopId: In(event.shopIds),
          role: In(rolesToNotify),
        },
      });

      // Deduplicate by userId, keep one shopId per user for the notification
      const userShopMap = new Map<string, UserShop>();
      for (const us of userShops) {
        if (us.userId !== event.createdByUserId && !userShopMap.has(us.userId)) {
          userShopMap.set(us.userId, us);
        }
      }

      // Verify users are active
      const userIds = [...userShopMap.keys()];
      if (!userIds.length) return;

      const activeUsers = await this.userRepo.find({
        where: { id: In(userIds), isActive: true },
        select: ['id'],
      });
      const activeUserIds = new Set(activeUsers.map((u) => u.id));

      // Create a notification for each eligible user
      const today = new Date().toISOString().slice(0, 10);

      for (const [userId, userShop] of userShopMap.entries()) {
        if (!activeUserIds.has(userId)) continue;

        await this.notificationService.createNotification({
          userId,
          shopId: userShop.shopId,
          type: NotificationType.PROMOTION_CREATED,
          title: 'Nueva promoción',
          message: `Nueva promoción activa: ${event.name}`,
          severity: NotificationSeverity.INFO,
          metadata: { promotionId: event.promotionId, promotionName: event.name },
          deduplicationKey: `PROMOTION_CREATED:${event.promotionId}:${userId}:${today}`,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing promotion.created event for ${event.promotionId}`,
        error,
      );
    }
  }

  private getRolesToNotify(creatorRole: UserRole): UserShopRole[] {
    if (!creatorRole) return [];

    switch (creatorRole) {
      case UserRole.OWNER:
        return [UserShopRole.MANAGER, UserShopRole.EMPLOYEE];
      case UserRole.MANAGER:
        return [UserShopRole.OWNER, UserShopRole.EMPLOYEE];
      case UserRole.EMPLOYEE:
        return [UserShopRole.OWNER, UserShopRole.MANAGER];
      default:
        return [];
    }
  }
}
