import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { envs } from '@/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envs.jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    payload: {
      sub: string;
      role: string;
      ownersub?: string | null;
      plan?: string;
      subscriptionStatus?: string;
    },
  ) {
    const { sub } = payload;

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!sub) {
      throw new UnauthorizedException('Token inválido o incompleto');
    }

    const user = await this.userRepository.findOneBy({ id: sub });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }
}
