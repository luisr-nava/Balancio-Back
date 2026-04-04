import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddCashRegisterAuditColumns
 *
 * Adds four audit columns that were added to the CashRegister entity after
 * synchronize:true was disabled. Because they are all nullable, they can
 * be added with ADD COLUMN IF NOT EXISTS in a single step — no data backfill
 * needed and no risk of violating existing rows.
 *
 * Columns added:
 *   openedByUserId  — uuid of the user who opened the register
 *   openedByName    — display name of that user (denormalised for speed)
 *   closedBy        — uuid of the user who closed the register
 *   closingNotes    — free-text notes left on close
 *
 * getLive() SELECTs and GROUP BYs cr."openedByName". Without this column
 * in the DB the query throws QueryFailedError → 500.
 */
export class AddCashRegisterAuditColumns1742348600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_registers"
        ADD COLUMN IF NOT EXISTS "openedByUserId" uuid,
        ADD COLUMN IF NOT EXISTS "openedByName"   character varying(150),
        ADD COLUMN IF NOT EXISTS "closedBy"        uuid,
        ADD COLUMN IF NOT EXISTS "closingNotes"    text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cash_registers"
        DROP COLUMN IF EXISTS "closingNotes",
        DROP COLUMN IF EXISTS "closedBy",
        DROP COLUMN IF EXISTS "openedByName",
        DROP COLUMN IF EXISTS "openedByUserId"
    `);
  }
}
