import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoveBarcodeUniquenessToShopProduct1742348800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_product"
      ADD COLUMN IF NOT EXISTS "barcode" character varying;
    `);

    await queryRunner.query(`
      UPDATE "shop_product" sp
      SET "barcode" = p."barcode"
      FROM "product" p
      WHERE sp."productId" = p."id"
        AND sp."barcode" IS NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'product'
            AND constraint_type = 'UNIQUE'
        ) THEN
          BEGIN
            ALTER TABLE "product"
            DROP CONSTRAINT "UQ_7ac18742b02b8af41afdaa3b9a9";
          EXCEPTION
            WHEN undefined_object THEN NULL;
          END;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'UQ_shop_barcode'
        ) THEN
          ALTER TABLE "shop_product"
          ADD CONSTRAINT "UQ_shop_barcode"
          UNIQUE ("shopId", "barcode");
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'UQ_shop_barcode'
        ) THEN
          ALTER TABLE "shop_product"
          DROP CONSTRAINT "UQ_shop_barcode";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'UQ_7ac18742b02b8af41afdaa3b9a9'
        ) THEN
          ALTER TABLE "product"
          ADD CONSTRAINT "UQ_7ac18742b02b8af41afdaa3b9a9"
          UNIQUE ("barcode");
        END IF;
      END
      $$;
    `);
  }
}
