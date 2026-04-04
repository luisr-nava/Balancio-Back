import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleItemSnapshotFields1742349100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale_item"
      ADD COLUMN IF NOT EXISTS "product_name" VARCHAR;
    `);

    await queryRunner.query(`
      ALTER TABLE "sale_item"
      ADD COLUMN IF NOT EXISTS "barcode" VARCHAR;
    `);

    await queryRunner.query(`
      ALTER TABLE "sale_item"
      ADD COLUMN IF NOT EXISTS "sale_price" NUMERIC;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale_item"
      DROP COLUMN IF EXISTS "sale_price";
    `);

    await queryRunner.query(`
      ALTER TABLE "sale_item"
      DROP COLUMN IF EXISTS "barcode";
    `);

    await queryRunner.query(`
      ALTER TABLE "sale_item"
      DROP COLUMN IF EXISTS "product_name";
    `);
  }
}
