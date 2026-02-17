import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, Repository } from 'typeorm';
import { EmailService } from '@/email/email.service';
import * as crypto from 'crypto';
import { VerificationCode } from './entities/verification-code.entity';
import { LoginDto } from './dto/login.dto';
import { envs } from '@/config';
import { JwtService } from '@nestjs/jwt';
import { VerificationType } from './interfaces';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-rol.dto';
import { BillingService } from '@/billing/billing.service';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly authRepository: Repository<User>,
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepository: Repository<VerificationCode>,
    private readonly billingService: BillingService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const { password, role: roleInput, ...user } = createUserDto;

    await this.validateEmailUnique(user.email);

    const createUserPayload: DeepPartial<User> = {
      ...user,
      role: UserRole.OWNER,
      hireDate: user.hireDate ? new Date(user.hireDate) : undefined,
      password: bcrypt.hashSync(password, 10),
    };
    const newUser = this.authRepository.create(createUserPayload);
    const savedUser = await this.authRepository.save(newUser);
    await this.sendVerificationCode(
      savedUser.id,
      savedUser.email,
      savedUser.fullName,
    );
    return {
      message:
        'Usuario creado correctamente. Se ha enviado un código de verificación a tu email',
      userId: savedUser.id,
    };
  }
  async createEmployee(createUserDto: CreateUserDto, requester: JwtPayload) {
    const { password, role, ...user } = createUserDto;

    if (!role) {
      throw new BadRequestException('El rol es obligatorio');
    }

    // 🔐 Reglas de creación
    if (requester.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('No tenés permisos para crear usuarios');
    }

    if (requester.role === UserRole.MANAGER && role !== UserRole.EMPLOYEE) {
      throw new ForbiddenException('Un encargado solo puede crear empleados');
    }

    if (![UserRole.EMPLOYEE, UserRole.MANAGER].includes(role)) {
      throw new BadRequestException('Rol inválido');
    }

    await this.validateEmailUnique(user.email);

    const createUserPayload: DeepPartial<User> = {
      ...user,
      role,
      hireDate: user.hireDate ? new Date(user.hireDate) : undefined,
      password: bcrypt.hashSync(password, 10),
      ownerId: requester.ownerId ?? requester.id, // 🔑 CLAVE
    };

    const newUser = this.authRepository.create(createUserPayload);
    const savedUser = await this.authRepository.save(newUser);

    await this.sendVerificationCode(
      savedUser.id,
      savedUser.email,
      savedUser.fullName,
    );

    return {
      message:
        role === UserRole.MANAGER
          ? 'Encargado creado correctamente'
          : 'Empleado creado correctamente',
      userId: savedUser.id,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.authRepository.findOne({
      where: { email },
    });

    if (!user?.isActive) {
      throw new ForbiddenException(
        'Usuario desactivado no puede realizar acciones',
      );
    }
    if (!user) {
      throw new ConflictException('Credenciales inválidas.');
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const now = new Date();
      const unlockDate = user.lockUntil;
      const diffMs = unlockDate.getTime() - now.getTime();
      const diffMinutes = Math.ceil(diffMs / (1000 * 60));
      throw new ConflictException(
        `Demasiados intentos fallidos. Podrás intentar nuevamente en ${diffMinutes} minuto(s).`,
      );
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;

      const update: Partial<User> = {
        failedLoginAttempts: attempts,
      };

      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);

        update.lockUntil = lockUntil;
        update.failedLoginAttempts = 0; // opcional

        await this.authRepository.save({
          id: user.id,
          ...update,
        });
        throw new ConflictException(
          `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por 15 minutos.`,
        );
      }

      await this.authRepository.save({
        id: user.id,
        ...update,
      });
      throw new ConflictException('Credenciales inválidas.');
    }

    if (!user.isVerify) {
      throw new ConflictException(
        'Debes verificar tu cuenta antes de iniciar sesión. Revisa tu email para obtener el código de verificación',
      );
    }

    await this.authRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockUntil: undefined,
      lastLogin: new Date(),
    });

    const token = this.jwtService.sign(
      {
        sub: user.id,
        role: user.role,
        ownerId: user.ownerId ?? null,
        email: user.email,
      },
      {
        secret: envs.jwtSecret,
        expiresIn: '1d',
      },
    );
    return {
      token,
      user,
      ownerId: user.ownerId ?? null,
    };
  }

  async verifyCode(code: string) {
    const verificationCode = await this.verificationCodeRepository.findOne({
      where: {
        code,
        isUsed: false,
      },
    });

    if (!verificationCode) {
      throw new BadRequestException(
        'Código de verificación inválido o expirado',
      );
    }

    if (new Date() > verificationCode.expiresAt) {
      throw new BadRequestException('El código de verificación ha expirado');
    }

    await this.authRepository.update(verificationCode.userId, {
      isVerify: true,
    });

    await this.verificationCodeRepository.delete(verificationCode.id);

    return {
      success: true,
      message: 'Cuenta verificada correctamente',
    };
  }

  async resendVerificationCode(email: string) {
    const genericResponse = {
      success: true,
      message:
        'Si el email existe y no está verificado, recibirás un nuevo código de verificación',
    };

    const user = await this.authRepository.findOneBy({ email });

    if (!user || user.isVerify) {
      return genericResponse;
    }

    const now = new Date();

    if (user.resendLockUntil && user.resendLockUntil > now) {
      return genericResponse;
    }

    const attempts = (user.resendAttempts ?? 0) + 1;

    const update: Partial<User> = {
      resendAttempts: attempts,
    };

    if (attempts >= 3) {
      update.resendLockUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
      update.resendAttempts = 0; // reset
    }

    await this.authRepository.save({
      id: user.id,
      ...update,
    });

    if (!update.resendLockUntil) {
      await this.sendVerificationCode(user.id, user.email, user.fullName);
    }

    return genericResponse;
  }

  async forgotPassword(email: string) {
    const genericResponse = {
      success: true,
      message:
        'Si el email existe, recibirás un enlace para restablecer tu contraseña',
    };

    const user = await this.authRepository.findOneBy({ email });

    if (!user) {
      return genericResponse;
    }

    if (!user.isVerify) {
      throw new BadRequestException(
        'Debes verificar tu cuenta antes de poder restablecer la contraseña',
      );
    }

    const now = new Date();

    if (user.forgotLockUntil && user.forgotLockUntil > now) {
      return genericResponse;
    }

    const attempts = (user.forgotAttempts ?? 0) + 1;

    const update: Partial<User> = {
      forgotAttempts: attempts,
    };

    if (attempts > 3) {
      update.forgotLockUntil = new Date(now.getTime() + 30 * 60 * 1000);
      update.forgotAttempts = 0;
    }

    await this.authRepository.save({
      id: user.id,
      ...update,
    });

    if (update.forgotLockUntil) {
      return genericResponse;
    }

    const hashedToken = crypto.createHash('sha256').digest('hex');

    await this.verificationCodeRepository.save({
      userId: user.id,
      code: hashedToken,
      type: VerificationType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const resetLink = `${envs.frontendUrl || 'http://localhost:3000'}/reset-password?token=${hashedToken}`;

    await this.emailService.sendPasswordResetEmail(
      user.email,
      resetLink,
      user.fullName,
    );

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    const passwordReset = await this.verificationCodeRepository.findOne({
      where: {
        code: token,
        type: VerificationType.PASSWORD_RESET,
        isUsed: false,
      },
    });

    if (!passwordReset) {
      throw new BadRequestException(
        'Token de recuperación inválido o expirado',
      );
    }

    if (new Date() > passwordReset.expiresAt) {
      throw new BadRequestException('El token de recuperación ha expirado');
    }

    const user = await this.authRepository.findOneBy({
      id: passwordReset.userId,
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.authRepository.update(user.id, {
      password: hashedPassword,
    });

    // 🧹 lo eliminamos (o podés marcar isUsed = true)
    await this.verificationCodeRepository.delete(passwordReset.id);

    return {
      success: true,
      message: 'Contraseña actualizada correctamente',
    };
  }

  async getUserById(id: string) {
    const user = await this.authRepository.findOneBy({ id });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const subscription = await this.billingService.getSubscriptionByOwner(
      user.id,
    );

    const {
      password,
      forgotAttempts,
      forgotLockUntil,
      failedLoginAttempts,
      resendAttempts,
      resendLockUntil,
      ...rest
    } = user;
    return {
      ...rest,
      plan: subscription?.plan ?? 'FREE',
      subscriptionStatus: subscription?.status ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      pendingPlan: subscription?.pendingPlan ?? null,
    };
  }

  async getEmployeesByOwner(ownerId: string) {
    const employees = await this.authRepository.find({
      where: {
        ownerId,
        role: In([UserRole.EMPLOYEE, UserRole.MANAGER]),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        dni: true,
        address: true,
        salary: true,
        hireDate: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!employees.length) {
      throw new NotFoundException(
        'No se encontraron empleados para este owner',
      );
    }

    return employees;
  }

  async updateUser(
    targetUserId: string,
    dto: UpdateUserDto,
    requester: JwtPayload,
  ) {
    const targetUser = await this.authRepository.findOne({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    this.validateUpdatePermissions(requester, targetUser);

    this.validateSalaryPermissions(requester, targetUser, dto);

    Object.assign(targetUser, {
      ...dto,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : targetUser.hireDate,
    });

    await this.authRepository.save(targetUser);

    return {
      message: 'Usuario actualizado correctamente',
    };
  }

  async updateUserRole(
    targetUserId: string,
    dto: UpdateUserRoleDto,
    requester: JwtPayload,
  ) {
    // 🔐 Solo OWNER
    if (requester.role !== UserRole.OWNER) {
      throw new ForbiddenException('Solo el owner puede cambiar roles');
    }

    const user = await this.authRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (dto.role === UserRole.OWNER) {
      throw new BadRequestException('No se puede asignar el rol DUEÑO');
    }

    const allowedTransitions = [UserRole.EMPLOYEE, UserRole.MANAGER];

    if (!allowedTransitions.includes(dto.role)) {
      throw new BadRequestException('Rol inválido');
    }

    user.role = dto.role;
    await this.authRepository.save(user);

    return {
      message: `Rol actualizado a ${dto.role}`,
    };
  }

  async deleteUser(targetUserId: string, requester: JwtPayload) {
    const target = await this.authRepository.findOne({
      where: { id: targetUserId },
    });

    if (!target?.isActive) {
      throw new BadRequestException('El usuario ya se encuentra desactivado');
    }

    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('No se puede eliminar un owner');
    }

    this.validateDeletePermissions(requester, target);

    target.isActive = false;
    target.deletedAt = new Date();
    target.deletedBy = requester.id;

    await this.authRepository.save(target);

    return { message: 'Usuario desactivado correctamente' };
  }
  // Private methods

  private async validateEmailUnique(email: string): Promise<void> {
    const userExist = await this.authRepository.findOne({
      where: { email },
    });
    if (userExist) {
      throw new ConflictException(`El email ${email} ya está registrado.`);
    }
  }

  private async sendVerificationCode(
    userId: string,
    email: string,
    fullName: string,
  ) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    await this.verificationCodeRepository.update(
      {
        userId,
        type: VerificationType.EMAIL_VERIFY,
        isUsed: false,
      },
      {
        isUsed: true,
      },
    );
    const verificationCode = this.verificationCodeRepository.create({
      userId,
      code,
      type: VerificationType.EMAIL_VERIFY,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await this.verificationCodeRepository.save(verificationCode);

    await this.emailService.sendVerificationEmail(email, code, fullName);
  }

  private validateUpdatePermissions(requester: JwtPayload, target: User) {
    if (requester.role === UserRole.EMPLOYEE && requester.sub !== target.id) {
      throw new ForbiddenException(
        'No tenés permisos para actualizar este usuario',
      );
    }

    // MANAGER → a sí mismo y EMPLOYEE
    if (requester.role === UserRole.MANAGER) {
      console.log(1);

      if (
        target.role === UserRole.OWNER ||
        (target.role === UserRole.MANAGER && requester.id !== target.id)
      ) {
        console.log(2);
        throw new ForbiddenException(
          'No tenés permisos para actualizar este usuario',
        );
      }
    }
  }

  private validateSalaryPermissions(
    requester: JwtPayload,
    target: User,
    dto: UpdateUserDto,
  ) {
    if (dto.salary === undefined) return;

    if (requester.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException(
        'No tenés permisos para modificar el salario',
      );
    }

    if (
      requester.role === UserRole.MANAGER &&
      target.role === UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'No podés modificar el salario de un encargado',
      );
    }
  }

  private validateDeletePermissions(requester: JwtPayload, target: User) {
    if (requester.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('No tenés permisos para eliminar usuarios');
    }

    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('No se puede eliminar un owner');
    }

    if (
      requester.role === UserRole.MANAGER &&
      target.role !== UserRole.EMPLOYEE
    ) {
      throw new ForbiddenException(
        'Un encargado solo puede eliminar empleados',
      );
    }
  }
}
