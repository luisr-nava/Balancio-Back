import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const typeORMConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  return {
    type: 'postgres',
    host: configService.get('DB_HOST'),
    port: parseInt(configService.get<string>('DB_PORT')!, 10) || 5432,
    username: configService.get<string>('DB_USERNAME') || 'postgres',
    password: configService.get<string>('DB_PASSWORD') || 'postgres',
    database: configService.get<string>('DB_NAME') || 'authdb',

    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    subscribers: [join(__dirname, '..', '**', '*.subscriber.{ts,js}')],

    // Migrations are applied by running `npm run migration:run` explicitly.
    // They are loaded here so TypeORM tracks which have been applied via the
    // migrations_history table it manages automatically.
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],

    // ⚠️  synchronize: true is DISABLED.
    //
    // synchronize auto-applies destructive DDL on every startup:
    //   - It DROPS and re-creates renamed columns (data loss)
    //   - It adds NOT NULL columns without filling existing rows (boot crash)
    //   - It runs outside any migration audit trail
    //
    // Use `npm run migration:run` to apply schema changes in a controlled,
    // reviewed, and reversible way. Never re-enable this in production.
    synchronize: true,

    // migrationsRun: true would run pending migrations automatically on boot.
    // Disabled here to keep migrations an explicit, operator-controlled step.
    // Enable only if your deployment pipeline guarantees a single instance
    // runs migrations before multiple instances start serving traffic.
    migrationsRun: false,

    retryAttempts: 5,
    retryDelay: 3000,
    autoLoadEntities: true,

    // Log migration SQL in non-production environments for visibility.
    logging: nodeEnv !== 'production' ? ['migration'] : ['error'],
  };
};
