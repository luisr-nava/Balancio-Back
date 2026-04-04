import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeGateway } from './realtime.gateway';
import { UserShop } from '@/auth/entities/user-shop.entity';
import { User } from '@/auth/entities/user.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([UserShop, User])],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
