import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload, TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';
import { UserShop, UserShopRole } from './entities/user-shop.entity';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DeepPartial, EntityManager, In, Repository } from 'typeorm';
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
import { NotificationService } from '@/notification/notification.service';
import {
  NotificationSeverity,
  NotificationType,
} from '@/notification/entities/notification.entity';
import { formatNotification } from '@/notification/notification-formatter';
import { Shop } from '@/shop/entities/shop.entity';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly authRepository: Repository<User>,
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepository: Repository<VerificationCode>,
    @InjectRepository(UserShop)
    private readonly userShopRepository: Repository<UserShop>,
    @InjectRepository(Shop)
    private readonly shopRepository: Repository<Shop>,
    private readonly billingService: BillingService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    const { password, role: roleInput, shopIds, ...user } = createUserDto;

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
    const { password, role, shopIds, ...user } = createUserDto;

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
    const assignedShopIds = await this.resolveEmployeeShopIds(
      requester,
      shopIds,
    );

    const createUserPayload: DeepPartial<User> = {
      ...user,
      role,
      hireDate: user.hireDate ? new Date(user.hireDate) : undefined,
      password: bcrypt.hashSync(password, 10),
      ownerId: requester.ownerId ?? requester.id, // 🔑 CLAVE
    };

    const userShopRole =
      role === UserRole.MANAGER ? UserShopRole.MANAGER : UserShopRole.EMPLOYEE;

    const savedUser = await this.authRepository.manager.transaction(
      async (manager) => {
        const newUser = manager.create(User, createUserPayload);
        const persistedUser = await manager.save(User, newUser);

        const relations = assignedShopIds.map((shopId) =>
          manager.create(UserShop, {
            userId: persistedUser.id,
            shopId,
            role: userShopRole,
          }),
        );

        await manager.save(UserShop, relations);

        return persistedUser;
      },
    );

    await this.sendVerificationCode(
      savedUser.id,
      savedUser.email,
      savedUser.fullName,
    );

  // Notify the owner (or the requester if they ARE the owner) about the new employee.
  // If a MANAGER creates an employee, the owner (requester.ownerId) is notified.
  // If an OWNER creates directly, they are notified themselves.
  const notifyUserId = (requester.ownerId as string | null) ?? requester.id;
  const metadata = {
    employeeId: savedUser.id,
    employeeName: savedUser.fullName,
    role: savedUser.role,
    createdBy: requester.id,
  };
  const { title, message } = formatNotification(
    NotificationType.EMPLOYEE_CREATED,
    metadata,
  );

  await this.notificationService.createNotification({
    userId: notifyUserId,
    type: NotificationType.EMPLOYEE_CREATED,
    title,
    message,
    severity: NotificationSeverity.INFO,
    metadata,
  });

    return {
      message:
        role === UserRole.MANAGER
          ? 'Encargado creado correctamente'
          : 'Empleado creado correctamente',
      userId: savedUser.id,
    };
  }

  private async resolveEmployeeShopIds(
    requester: JwtPayload,
    requestedShopIds?: string[],
  ): Promise<string[]> {
    if (requester.role === UserRole.OWNER) {
      if (!requestedShopIds?.length) {
        throw new BadRequestException('Debes seleccionar al menos una tienda');
      }

      const ownerShopIds = [...new Set(requestedShopIds)];

      const allowedShopCount = await this.shopRepository.count({
        where: {
          id: In(ownerShopIds),
          ownerId: requester.id,
        },
      });

      if (allowedShopCount !== ownerShopIds.length) {
        throw new ForbiddenException(
          'No tienes acceso a una o más tiendas especificadas',
        );
      }

      return ownerShopIds;
    }

    const managerShops = await this.userShopRepository.find({
      where: { userId: requester.id },
      select: ['shopId'],
    });
    const managerShopIds = [
      ...new Set(managerShops.map((shop) => shop.shopId)),
    ];

    if (!managerShopIds.length) {
      throw new ForbiddenException(
        'No tienes tiendas asignadas para heredar al empleado',
      );
    }

    return managerShopIds;
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

    const { accessToken, refreshToken } = this.generateTokens(user);

    return {
      token: accessToken,
      refreshToken,
      user,
      ownerId: user.ownerId ?? null,
    };
  }

  async refreshAccessToken(
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; role: string; ownerId: string | null };

    try {
      payload = this.jwtService.verify<{
        sub: string;
        role: string;
        ownerId: string | null;
      }>(rawRefreshToken, { secret: envs.jwtRefreshSecret });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Refresh token expirado');
      }
      if (err instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Refresh token inválido');
      }
      throw new UnauthorizedException('Error al validar el refresh token');
    }

    const user = await this.authRepository.findOneBy({ id: payload.sub });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o desactivado');
    }

    return this.generateTokens(user);
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

    const hashedToken = crypto.randomBytes(32).toString('hex');

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

  async getEmployeesByOwner(
    ownerId: string,
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      role?: UserRole;
      shopId?: string;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const search = filters.search?.trim();

    if (
      filters.role &&
      ![UserRole.EMPLOYEE, UserRole.MANAGER].includes(filters.role)
    ) {
      throw new BadRequestException('Rol inválido');
    }

    const employeesQb = this.authRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userShops', 'userShop')
      .leftJoinAndSelect('userShop.shop', 'shop')
      .where('user.ownerId = :ownerId', { ownerId })
      .andWhere('user.role IN (:...roles)', {
        roles: [UserRole.EMPLOYEE, UserRole.MANAGER],
      })
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.role',
        'user.phone',
        'user.dni',
        'user.address',
        'user.salary',
        'user.hireDate',
        'user.createdAt',
        'userShop.id',
        'userShop.shopId',
        'shop.id',
        'shop.name',
      ])
      .distinct(true)
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('shop.name', 'ASC');

    if (search) {
      employeesQb.andWhere(
        new Brackets((qb) => {
          qb.where('user.fullName ILIKE :search', {
            search: `%${search}%`,
          }).orWhere('user.email ILIKE :search', {
            search: `%${search}%`,
          });
        }),
      );
    }

    if (filters.role) {
      employeesQb.andWhere('user.role = :role', {
        role: filters.role,
      });
    }

    if (filters.shopId) {
      employeesQb.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from(UserShop, 'filterUserShop')
          .where('filterUserShop.userId = user.id')
          .andWhere('filterUserShop.shopId = :shopId')
          .getQuery();

        return `EXISTS ${subQuery}`;
      });
      employeesQb.setParameter('shopId', filters.shopId);
    }

    const [employees, total] = await employeesQb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (!employees.length) {
      throw new NotFoundException(
        'No se encontraron empleados para este owner',
      );
    }

    const data = employees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      role: employee.role,
      phone: employee.phone,
      dni: employee.dni,
      address: employee.address,
      salary: employee.salary,
      hireDate: employee.hireDate,
      createdAt: employee.createdAt,
      shops: (employee.userShops ?? [])
        .filter((userShop) => userShop.shop)
        .map((userShop) => ({
          id: userShop.shop.id,
          name: userShop.shop.name,
        })),
    }));

    return {
      data,
      total,
      page,
      limit,
    };
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

    const { shopIds, ...userUpdates } = dto;
    const resolvedShopIds =
      shopIds !== undefined
        ? await this.resolveShopIdsForUpdate(requester, shopIds)
        : undefined;

    await this.authRepository.manager.transaction(async (manager) => {
      Object.assign(targetUser, {
        ...userUpdates,
        hireDate: userUpdates.hireDate
          ? new Date(userUpdates.hireDate)
          : targetUser.hireDate,
      });

      await manager.save(User, targetUser);

      if (resolvedShopIds !== undefined) {
        const userShopRole = this.getUserShopRoleForAssignment(targetUser.role);
        await this.syncUserShopAssignments(
          manager,
          targetUser.id,
          resolvedShopIds,
          userShopRole,
        );
      }
    });

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

    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!target.isActive) {
      throw new BadRequestException('El usuario ya se encuentra desactivado');
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

    await this.emailService.sendVerificationEmail(
      email,
      code,
      fullName,
      userId,
    );
  }

  private validateUpdatePermissions(requester: JwtPayload, target: User) {
    if (requester.role === UserRole.EMPLOYEE && requester.sub !== target.id) {
      throw new ForbiddenException(
        'No tenés permisos para actualizar este usuario',
      );
    }

    // MANAGER → a sí mismo y EMPLOYEE
    if (requester.role === UserRole.MANAGER) {
      if (
        target.role === UserRole.OWNER ||
        (target.role === UserRole.MANAGER && requester.id !== target.id)
      ) {
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

  private async validateDeletePermissions(
    requester: JwtPayload,
    target: User,
  ) {
    if (requester.id === target.id) {
      return;
    }

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

    if (requester.role === UserRole.MANAGER || requester.role === UserRole.OWNER) {
      const requesterShops = await this.userShopRepository.find({
        where: { userId: requester.id },
      });
      const requesterShopIds = requesterShops.map((us) => us.shopId);

      const targetShops = await this.userShopRepository.find({
        where: { userId: target.id },
      });
      const targetShopIds = targetShops.map((us) => us.shopId);

      const hasCommonShop = targetShopIds.some((shopId) =>
        requesterShopIds.includes(shopId),
      );

      if (!hasCommonShop) {
        throw new ForbiddenException(
          'No tienes permisos para eliminar este usuario',
        );
      }
    }
  }

  private async resolveShopIdsForUpdate(
    requester: JwtPayload,
    requestedShopIds: string[],
  ): Promise<string[]> {
    const uniqueShopIds = [...new Set(requestedShopIds)];

    if (!uniqueShopIds.length) {
      return [];
    }

    if (requester.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException('No tenés permisos para actualizar tiendas');
    }

    if (requester.role === UserRole.OWNER) {
      const allowedShopCount = await this.shopRepository.count({
        where: {
          id: In(uniqueShopIds),
          ownerId: requester.id,
        },
      });

      if (allowedShopCount !== uniqueShopIds.length) {
        throw new ForbiddenException(
          'No tienes acceso a una o más tiendas especificadas',
        );
      }

      return uniqueShopIds;
    }

    const requesterShops = await this.userShopRepository.find({
      where: { userId: requester.id },
      select: ['shopId'],
    });
    const allowedShopIds = new Set(requesterShops.map((shop) => shop.shopId));
    const invalidShopIds = uniqueShopIds.filter(
      (id) => !allowedShopIds.has(id),
    );

    if (invalidShopIds.length) {
      throw new ForbiddenException(
        'No tienes acceso a una o más tiendas especificadas',
      );
    }

    return uniqueShopIds;
  }

  private getUserShopRoleForAssignment(role: UserRole): UserShopRole {
    if (role === UserRole.MANAGER) {
      return UserShopRole.MANAGER;
    }

    if (role === UserRole.EMPLOYEE) {
      return UserShopRole.EMPLOYEE;
    }

    throw new BadRequestException(
      'Solo se pueden asignar tiendas a empleados o encargados',
    );
  }

  private async syncUserShopAssignments(
    manager: EntityManager,
    userId: string,
    nextShopIds: string[],
    role: UserShopRole,
  ): Promise<void> {
    const currentRelations = await manager.find(UserShop, {
      where: { userId },
      select: ['id', 'shopId', 'role'],
    });

    const existingShopIds = new Set(
      currentRelations.map((relation) => relation.shopId),
    );
    const nextShopIdSet = new Set(nextShopIds);

    const toAdd = nextShopIds.filter((shopId) => !existingShopIds.has(shopId));
    const toRemove = currentRelations
      .filter((relation) => !nextShopIdSet.has(relation.shopId))
      .map((relation) => relation.shopId);
    const toUpdateRoleIds = currentRelations
      .filter(
        (relation) =>
          nextShopIdSet.has(relation.shopId) && relation.role !== role,
      )
      .map((relation) => relation.id);

    if (toAdd.length) {
      const relationsToInsert = toAdd.map((shopId) =>
        manager.create(UserShop, {
          userId,
          shopId,
          role,
        }),
      );

      await manager.save(UserShop, relationsToInsert);
    }

    if (toRemove.length) {
      await manager.delete(UserShop, {
        userId,
        shopId: In(toRemove),
      });
    }

    if (toUpdateRoleIds.length) {
      await manager.update(UserShop, { id: In(toUpdateRoleIds) }, { role });
    }
  }

  private generateTokens(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
    const tokenPayload = {
      sub: user.id,
      role: user.role,
      ownerId: user.ownerId ?? null,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(tokenPayload, {
      secret: envs.jwtSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(tokenPayload, {
      secret: envs.jwtRefreshSecret,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
