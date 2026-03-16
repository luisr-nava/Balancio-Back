import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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

  /**
   * Clave de deduplicación opcional.
   * Si se proporciona, el servicio no creará otra notificación
   * con la misma clave en las últimas 24 horas.
   */
  @IsOptional()
  @IsString()
  deduplicationKey?: string;
}
