import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GetUser } from '@/auth/decorators/get-user.decorators';

interface AuthUser {
  id: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('profile')
  getProfile(@GetUser() user: AuthUser) {
    return this.settingsService.getProfile(user.id);
  }

  @Patch('profile')
  updateProfile(@GetUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.settingsService.updateProfile(user.id, dto);
  }

  @Patch('change-password')
  changePassword(@GetUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.settingsService.changePassword(user.id, dto);
  }
}
