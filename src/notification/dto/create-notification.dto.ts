import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  NotificationSeverity,
  NotificationType,
} from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  /** Nullable for system-level notifications without a shop context. */
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationSeverity)
  severity: NotificationSeverity;

  /**
   * Optional JSON payload for dynamic data (e.g. { saleId, amount }).
   * The service stores this verbatim — keep it small.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /**
   * Deduplication key (optional).
   * If provided, the service will not create another notification with the
   * same key within the last 24 hours.
   */
  @IsOptional()
  @IsString()
  deduplicationKey?: string;

  /**
   * Grouping key (optional).
   * If provided, the service will aggregate with existing notifications
   * with the same key from the same day, incrementing count and updating
   * metadata.total.
   */
  @IsOptional()
  @IsString()
  groupKey?: string;
}
