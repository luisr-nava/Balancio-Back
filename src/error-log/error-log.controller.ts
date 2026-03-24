import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ErrorLogService } from './error-log.service';
import { CreateErrorLogDto } from './dto/create-error-log.dto';
import { GetErrorLogsDto } from './dto/get-error-logs.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { UserRole } from '@/auth/entities/user.entity';

@Controller('error-logs')
export class ErrorLogController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  /**
   * Public — frontend sends error reports without authentication.
   * TODO: add rate-limiting (@nestjs/throttler) before production.
   */
  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async create(@Body() dto: CreateErrorLogDto): Promise<void> {
    // Fire-and-forget — never let logging failures surface as API errors
    this.errorLogService.createFromDto(dto).catch(() => {});
  }

  /**
   * Protected — returns paginated error logs with optional filters.
   * Restricted to SUPER_ADMIN (platform-level role, not shop OWNER).
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async findAll(@Query() dto: GetErrorLogsDto) {
    return this.errorLogService.findAll(dto);
  }

  /**
   * Protected — returns aggregate stats: total, top-5 by occurrences, breakdown by severity.
   * Restricted to SUPER_ADMIN (platform-level role, not shop OWNER).
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getStats() {
    return this.errorLogService.getStats();
  }
}
