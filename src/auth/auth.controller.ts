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
  UseGuards,
} from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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
