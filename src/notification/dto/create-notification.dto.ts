import { IsEnum, IsString, IsUUID } from 'class-validator';
import {
  NotificationSeverity,
  NotificationType,
} from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  shopId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  message: string;

  @IsEnum(NotificationSeverity)
  severity: NotificationSeverity;
}
