import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'jsonwebtoken';
import { GetUser } from '@/auth/decorators/get-user.decorators';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(@GetUser() user: AuthUser) {
    return this.notificationService.getUserNotifications(user.id);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    await this.notificationService.markAsRead(id);
    return { message: 'Notification marked as read' };
  }

  @Patch('read-all')
  async markAllAsRead(@GetUser() user: AuthUser) {
    await this.notificationService.markAllAsRead(user.id);
    return { message: 'All notifications marked as read' };
  }
}
