import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceShopBarcodeConstraintWithActiveIndex1742349200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'shop_product'
            AND constraint_name = 'UQ_shop_barcode'
        ) THEN
          ALTER TABLE "shop_product"
          DROP CONSTRAINT "UQ_shop_barcode";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shop_barcode_active"
      ON "shop_product" ("shopId", "barcode")
      WHERE "deletedAt" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_shop_barcode_active";
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'shop_product'
            AND constraint_name = 'UQ_shop_barcode'
        ) THEN
          ALTER TABLE "shop_product"
          ADD CONSTRAINT "UQ_shop_barcode"
          UNIQUE ("shopId", "barcode");
        END IF;
      END
      $$;
    `);
  }
}
