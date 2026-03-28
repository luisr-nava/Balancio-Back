import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResendVerificationCodeDto } from './dto/resend-verification-code.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';
import { GetUser } from './decorators/get-user.decorators';
import { JwtPayload } from 'jsonwebtoken';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-rol.dto';
import { envs } from '@/config';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: envs.nodeEnv === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, refreshToken, user, ownerId } =
      await this.authService.login(loginDto);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    return { token, user, ownerId };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken: string | undefined =
      req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    const { accessToken, refreshToken } =
      await this.authService.refreshAccessToken(rawRefreshToken);

    // Token rotation: replace old cookie with new refresh token
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    return { token: accessToken };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: envs.nodeEnv === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  @Post('verify-code')
  verifyCode(@Body() verifyCodeDto: VerifyCodeDto) {
    return this.authService.verifyCode(verifyCodeDto.code);
  }

  @Post('resend-verification-code')
  resendVerificationCode(@Body() resendDto: ResendVerificationCodeDto) {
    return this.authService.resendVerificationCode(resendDto.email);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('employee')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  createEmployee(
    @GetUser() requester: JwtPayload,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.createEmployee(createUserDto, requester);
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-user')
  getUser(@GetUser() user: User) {
    return this.authService.getUserById(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('get-employees')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getEmployees(@GetUser() user: User) {
    return this.authService.getEmployeesByOwner(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/:id')
  updateUser(
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
    @GetUser() requester: JwtPayload,
  ) {
    return this.authService.updateUser(userId, dto, requester);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @Patch(':id/role')
  updateUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @GetUser() requester: JwtPayload,
  ) {
    return this.authService.updateUserRole(userId, dto, requester);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete/:id')
  async deleteUser(
    @Param('id') userId: string,
    @GetUser() requester: JwtPayload,
  ) {
    return this.authService.deleteUser(userId, requester);
  }
}
