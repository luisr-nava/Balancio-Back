import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { UpdateNotificationPreferenceDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { NotificationType } from './entities/notification.entity';
import { User } from '@/auth/entities/user.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Returns paginated notifications for the authenticated user.
   * Supports filtering by isRead and type.
   */
  @Get()
  getUserNotifications(
    @GetUser() user: User,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationService.getUserNotifications(user.id, query);
  }

  /**
   * GET /notifications/unread-count
   * Returns the count of unread notifications — used for the badge.
   */
  @Get('unread-count')
  getUnreadCount(@GetUser() user: User) {
    return this.notificationService.getUnreadCount(user.id);
  }

  /**
   * PATCH /notifications/read-all
   * Marks every unread notification for this user as read.
   * Must be declared BEFORE /:id routes to avoid being captured by the param matcher.
   */
  @Patch('read-all')
  markAllAsRead(@GetUser() user: User) {
    return this.notificationService.markAllAsRead(user.id);
  }

  /**
   * PATCH /notifications/:id/read
   * Marks a single notification as read.
   * Ownership is enforced in the service — only the notification's owner
   * can mark it as read (throws 404 if the id doesn't belong to this user).
   */
  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.notificationService.markAsRead(id, user.id);
  }

  /** GET /notifications/preferences */
  @Get('preferences')
  getPreferences(@GetUser() user: User) {
    return this.notificationService.getUserPreferences(user.id);
  }

  /** PATCH /notifications/preferences/:type */
  @Patch('preferences/:type')
  updatePreference(
    @GetUser() user: User,
    @Param('type', new ParseEnumPipe(NotificationType)) type: NotificationType,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notificationService.updateUserPreference(
      user.id,
      type,
      dto.enabled,
    );
  }
}
