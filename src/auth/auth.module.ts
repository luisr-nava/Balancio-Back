import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '@/email/email.module';
import { VerificationCode } from './entities/verification-code.entity';
import { VerificationCodeCleanupJob } from '@/jobs/verification-code.cleanup.job';
import { JwtStrategy } from './strategies/jwt.strategies';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, VerificationCodeCleanupJob],
  imports: [
    ConfigModule,
    EmailModule,
    TypeOrmModule.forFeature([VerificationCode, User]),
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // Access token: 15 minutos
      }),
    }),
  ],
})
export class AuthModule {}
