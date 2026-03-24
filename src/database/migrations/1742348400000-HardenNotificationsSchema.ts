import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: HardenNotificationsSchema
 *
 * Applies every schema change accumulated since the notifications table was
 * created under synchronize:true — in a single, ordered, transactional migration.
 *
 * Changes (in safe dependency order):
 *
 *   1. Extend the `type` enum with 4 new values.
 *      PostgreSQL does not allow ALTER TYPE … ADD VALUE inside a transaction.
 *      Solution: drop-and-recreate the enum type entirely (transactional).
 *
 *   2. Rename `read` → `isRead`.
 *      synchronize:true would DROP + ADD → every notification loses its read state.
 *      RENAME COLUMN preserves all existing data.
 *
 *   3. Add `title` column (nullable → fill → NOT NULL).
 *      This is the immediate cause of the boot error.
 *      The 3-step pattern is the only zero-data-loss approach for a NOT NULL column
 *      on a table that already contains rows.
 *
 *   4. Add `metadata` column (jsonb, nullable — no data risk).
 *
 *   5. Make `shopId` nullable and retype from varchar → uuid.
 *      System-level notifications (e.g. EMPLOYEE_CREATED) have no shop context.
 *
 *   6. Drop the old single-column indexes and add the new composite indexes.
 *      Composite indexes cover the specific query patterns and make the old
 *      single-column ones redundant.
 */
export class HardenNotificationsSchema1742348400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────────────────────────────────────────────────────────────────────────
    // 1. Extend the type enum
    //
    // PostgreSQL does not allow ALTER TYPE … ADD VALUE inside a transaction.
    // The safe, fully transactional alternative is to:
    //   a. Temporarily store the column values as text
    //   b. Drop the old enum
    //   c. Create a new enum with all current + new values
    //   d. Restore the column to the new enum type
    // ────────────────────────────────────────────────────────────────────────

    // a. Temporarily convert the column to text so we can drop the old enum
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "type" TYPE text
    `);

    // b. Drop the old enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS "notifications_type_enum"
    `);

    // c. Recreate it with the full set of values
    await queryRunner.query(`
      CREATE TYPE "notifications_type_enum" AS ENUM (
        'SALE_CREATED',
        'SALE_CANCELED',
        'PAYMENT_RECEIVED',
        'LOW_STOCK',
        'CASH_CLOSED',
        'CASH_OPENED',
        'EMPLOYEE_CREATED',
        'PROMOTION_CREATED',
        'SYSTEM_ALERT'
      )
    `);

    // d. Restore the column to the new enum — USING casts the text values back
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "type"
        TYPE "notifications_type_enum"
        USING "type"::"notifications_type_enum"
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 2. Rename read → isRead
    //
    // Must use RENAME COLUMN, not DROP + ADD.
    // DROP + ADD (what synchronize:true would do) resets every row to the
    // column default (false), silently discarding which notifications the user
    // had already read.
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        RENAME COLUMN "read" TO "isRead"
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 3. Add `title` column — the direct cause of the boot error
    //
    // Pattern for adding a NOT NULL column to a table with existing rows:
    //   Step A — add as nullable (no constraint violation on existing rows)
    //   Step B — fill every existing row with a meaningful derived value
    //   Step C — set NOT NULL (safe: no NULLs remain after step B)
    //
    // The default is derived from `type` so titles are meaningful, not generic.
    // ────────────────────────────────────────────────────────────────────────

    // A — add nullable
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN "title" character varying
    `);

    // B — fill existing rows
    await queryRunner.query(`
      UPDATE "notifications"
      SET "title" = CASE "type"
        WHEN 'SALE_CREATED'      THEN 'Nueva venta registrada'
        WHEN 'SALE_CANCELED'     THEN 'Venta anulada'
        WHEN 'PAYMENT_RECEIVED'  THEN 'Pago recibido'
        WHEN 'LOW_STOCK'         THEN 'Stock bajo'
        WHEN 'CASH_CLOSED'       THEN 'Caja cerrada'
        WHEN 'CASH_OPENED'       THEN 'Caja abierta'
        WHEN 'EMPLOYEE_CREATED'  THEN 'Nuevo integrante del equipo'
        WHEN 'PROMOTION_CREATED' THEN 'Nueva promoción'
        WHEN 'SYSTEM_ALERT'      THEN 'Alerta del sistema'
        ELSE                          'Notificación'
      END
      WHERE "title" IS NULL
    `);

    // C — now safe to enforce NOT NULL
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "title" SET NOT NULL
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 4. Add `metadata` column (jsonb, nullable)
    // Safe to add directly — nullable columns never violate existing rows.
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT NULL
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 5. Make `shopId` nullable + retype from varchar → uuid
    //
    // System-level notifications (EMPLOYEE_CREATED, SYSTEM_ALERT) have no
    // shop context, so shopId must accept NULL.
    //
    // Existing values are valid UUID strings — the USING clause casts them.
    // ────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "shopId" DROP NOT NULL,
        ALTER COLUMN "shopId"
          TYPE uuid
          USING "shopId"::uuid
    `);

    // ────────────────────────────────────────────────────────────────────────
    // 6. Replace old indexes with composite indexes
    //
    // The old single-column index on "read" is now stale (column was renamed).
    // The new composite indexes cover every query pattern with a single index
    // scan instead of two.
    // ────────────────────────────────────────────────────────────────────────

    // Drop stale indexes left from synchronize:true
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_deduplicationKey"`);

    // (userId, createdAt) — default inbox query
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_createdAt"
        ON "notifications" ("userId", "createdAt" DESC)
    `);

    // (userId, isRead) — unread-count badge
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_isRead"
        ON "notifications" ("userId", "isRead")
    `);

    // (userId, type, createdAt) — type-filtered inbox
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_type_createdAt"
        ON "notifications" ("userId", "type", "createdAt" DESC)
    `);

    // (userId, shopId, createdAt) — shop-filtered inbox
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_shopId_createdAt"
        ON "notifications" ("userId", "shopId", "createdAt" DESC)
    `);

    // deduplicationKey — partial index (skips NULL rows, keeps index small)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_deduplicationKey"
        ON "notifications" ("deduplicationKey")
        WHERE "deduplicationKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Reverse indexes ──────────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_deduplicationKey"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_userId_shopId_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_userId_type_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_userId_isRead"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_userId_createdAt"`);

    // ── Reverse shopId ───────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "shopId" TYPE character varying USING "shopId"::text,
        ALTER COLUMN "shopId" SET NOT NULL
    `);

    // ── Reverse metadata ─────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "metadata"
    `);

    // ── Reverse title ────────────────────────────────────────────────────────
    // Data cannot be recovered — title values were generated from type.
    // Dropping is the only option for a true rollback.
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "title"
    `);

    // ── Reverse isRead → read ────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        RENAME COLUMN "isRead" TO "read"
    `);

    // ── Reverse enum (restore original 5 values) ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "type" TYPE text
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);

    await queryRunner.query(`
      CREATE TYPE "notifications_type_enum" AS ENUM (
        'SALE_CANCELED',
        'LOW_STOCK',
        'CASH_CLOSED',
        'CASH_OPENED',
        'PROMOTION_CREATED'
      )
    `);

    // Rows with a new type value (SALE_CREATED, PAYMENT_RECEIVED, etc.)
    // cannot be cast back — default them to SALE_CANCELED to avoid a cast error.
    await queryRunner.query(`
      UPDATE "notifications"
      SET "type" = 'SALE_CANCELED'
      WHERE "type" NOT IN (
        'SALE_CANCELED', 'LOW_STOCK', 'CASH_CLOSED', 'CASH_OPENED', 'PROMOTION_CREATED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "notifications"
        ALTER COLUMN "type"
        TYPE "notifications_type_enum"
        USING "type"::"notifications_type_enum"
    `);
  }
}
