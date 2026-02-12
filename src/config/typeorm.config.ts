import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
export const typeORMConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: configService.get('DB_HOST'),
    port: parseInt(configService.get<string>('DB_PORT')!, 10) || 5432,
    username: configService.get<string>('DB_USERNAME') || 'postgres',
    password: configService.get<string>('DB_PASSWORD') || 'postgres',
    database: configService.get<string>('DB_NAME') || 'authdb',
    // entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    synchronize: true,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    subscribers: [join(__dirname, '..', '**', '*.subscriber.{ts,js}')],
    retryAttempts: 5,
    retryDelay: 3000,
    autoLoadEntities: true,
  };
};
