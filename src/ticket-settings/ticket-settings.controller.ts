import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TicketSettingsService } from './ticket-settings.service';
import { UpdateTicketSettingsDto } from './dto/update-ticket-settings.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';
import { User } from '@/auth/entities/user.entity';

@Controller('ticket-settings')
@UseGuards(JwtAuthGuard)
export class TicketSettingsController {
  constructor(
    private readonly ticketSettingsService: TicketSettingsService,
  ) {}

  @Get()
  async getSettings(
    @GetUser() user: User,
    @Query('shopId') shopId: string,
  ) {
    return this.ticketSettingsService.getSettings(shopId, user);
  }

  @Patch()
  async updateSettings(
    @GetUser() user: User,
    @Query('shopId') shopId: string,
    @Body() dto: UpdateTicketSettingsDto,
  ) {
    return this.ticketSettingsService.updateSettings(shopId, dto, user);
  }
}
