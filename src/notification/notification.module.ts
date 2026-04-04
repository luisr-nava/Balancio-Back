import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationListener } from './notification.listener';
import { Notification } from './entities/notification.entity';
import { UserNotificationPreference } from './entities/notification-preference.entity';
import { User } from '@/auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserNotificationPreference, User]),
    // EventEmitterModule is registered globally in AppModule — no re-import needed.
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationListener, // Handles NOTIFICATION_EVENTS.CREATE from any module
  ],
  exports: [
    NotificationService, // For modules that trigger notifications inside transactions
    NotificationGateway, // Rarely needed externally; exported for flexibility
  ],
})
export class NotificationModule {}
