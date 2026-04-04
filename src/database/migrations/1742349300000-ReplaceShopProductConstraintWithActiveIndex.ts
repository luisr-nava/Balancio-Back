import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceShopProductConstraintWithActiveIndex1742349300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'shop_product'
            AND constraint_name = 'UQ_706466b6a7d3efda2f7b614c14d'
        ) THEN
          ALTER TABLE "shop_product"
          DROP CONSTRAINT "UQ_706466b6a7d3efda2f7b614c14d";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shop_product_active"
      ON "shop_product" ("shopId", "productId")
      WHERE "deletedAt" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_shop_product_active";
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'shop_product'
            AND constraint_name = 'UQ_706466b6a7d3efda2f7b614c14d'
        ) THEN
          ALTER TABLE "shop_product"
          ADD CONSTRAINT "UQ_706466b6a7d3efda2f7b614c14d"
          UNIQUE ("shopId", "productId");
        END IF;
      END
      $$;
    `);
  }
}
