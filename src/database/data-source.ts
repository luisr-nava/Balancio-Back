/**
 * Standalone TypeORM DataSource used exclusively by the TypeORM CLI:
 *   migration:generate  — diff entities vs DB → produce a migration file
 *   migration:run       — apply pending migrations in order
 *   migration:revert    — roll back the last applied migration
 *
 * This file is intentionally separate from the NestJS AppModule so the CLI
 * can connect to the database without booting the entire application.
 *
 * It reads the same env vars as the NestJS app (via dotenv) so dev/prod
 * environments are consistent.
 *
 * Usage (from the project root):
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:generate -- src/database/migrations/MyMigration
 *   npm run migration:show
 */
import 'tsconfig-paths/register';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';

export default new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'postgres',
  password: process.env['DB_PASSWORD'],
  database: process.env['DB_NAME'],

  // Entity glob — mirrors typeorm.config.ts so the CLI sees the same schema
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],

  // Migrations are loaded from a single canonical directory.
  // Order is determined by the timestamp prefix in each filename.
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],

  // NEVER enable synchronize in this file — it would auto-modify the schema
  // outside of the controlled migration flow.
  synchronize: false,

  // Log the SQL executed by each migration for auditing.
  logging: ['migration'],
});
