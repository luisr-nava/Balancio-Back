import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: CreateErrorLogsTable
 *
 * Creates the `error_logs` table to match the ErrorLog entity.
 *
 * The entity was added after the initial synchronize:true period, so no
 * automatic table was ever created. This migration creates it from scratch.
 */
export class CreateErrorLogsTable1742348500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the severity enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'error_logs_severity_enum'
        ) THEN
          CREATE TYPE "error_logs_severity_enum"
          AS ENUM ('low', 'medium', 'critical');
        END IF;
      END
      $$;
      `);

    // Create the table
    await queryRunner.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'error_logs'
      ) THEN
        CREATE TABLE "error_logs" (
          "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
          "message"      text NOT NULL,
          "stack"        text,
          "context"      jsonb,
          "userId"       uuid,
          "shopId"       uuid,
          "path"         character varying NOT NULL,
          "method"       character varying NOT NULL,
          "severity"     "error_logs_severity_enum" NOT NULL DEFAULT 'medium',
          "source"       character varying NOT NULL DEFAULT 'frontend',
          "fingerprint"  character varying(32),
          "occurrences"  integer NOT NULL DEFAULT 1,
          "lastSeenAt"   timestamp,
          "createdAt"    TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_error_logs" PRIMARY KEY ("id")
        );
      END IF;
    END
    $$;
    `);

    // Indexes matching the entity decorators
    await queryRunner.query(`
      CREATE INDEX "IDX_error_logs_createdAt"
        ON "error_logs" ("createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_error_logs_userId_createdAt"
        ON "error_logs" ("userId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_error_logs_severity_createdAt"
        ON "error_logs" ("severity", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_error_logs_fingerprint"
        ON "error_logs" ("fingerprint")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_error_logs_fingerprint"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_error_logs_severity_createdAt"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_error_logs_userId_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_error_logs_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "error_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "error_logs_severity_enum"`);
  }
}
