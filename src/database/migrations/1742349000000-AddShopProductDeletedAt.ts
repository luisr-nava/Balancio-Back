import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShopProductDeletedAt1742349000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_product"
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_product"
      DROP COLUMN IF EXISTS "deletedAt";
    `);
  }
}
