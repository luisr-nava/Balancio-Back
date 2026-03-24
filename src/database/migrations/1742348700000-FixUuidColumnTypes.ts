import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: FixUuidColumnTypes
 *
 * Several columns were created as character varying during the synchronize:true
 * period but hold UUID values. This causes PostgreSQL to reject queries that
 * compare them with uuid-typed parameters or columns.
 *
 * Failing example:
 *   SELECT ... FROM cash_registers cr WHERE cr."shopId" = $1
 *   ERROR: operator does not exist: character varying = uuid
 *
 * Columns fixed:
 *   cash_registers."shopId"        varchar → uuid
 *   cash_registers."employeeId"    varchar → uuid
 *   cash_movement."cashRegisterId" varchar → uuid
 *   cash_movement."shopId"         varchar → uuid
 *
 * The USING clause casts existing string data to uuid safely. Rows with
 * invalid uuid strings would fail — but all data already came from uuid
 * primary keys so the cast will succeed.
 */
export class FixUuidColumnTypes1742348700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_registers"
        ALTER COLUMN "shopId"     TYPE uuid USING "shopId"::uuid,
        ALTER COLUMN "employeeId" TYPE uuid USING "employeeId"::uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_movement"
        ALTER COLUMN "cashRegisterId" TYPE uuid USING "cashRegisterId"::uuid,
        ALTER COLUMN "shopId"         TYPE uuid USING "shopId"::uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_movement"
        ALTER COLUMN "shopId"         TYPE character varying USING "shopId"::text,
        ALTER COLUMN "cashRegisterId" TYPE character varying USING "cashRegisterId"::text
    `);

    await queryRunner.query(`
      ALTER TABLE "cash_registers"
        ALTER COLUMN "employeeId" TYPE character varying USING "employeeId"::text,
        ALTER COLUMN "shopId"     TYPE character varying USING "shopId"::text
    `);
  }
}
