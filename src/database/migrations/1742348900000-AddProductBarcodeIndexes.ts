import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductBarcodeIndexes1742348900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_barcode_not_null"
      ON "product" ("barcode")
      WHERE "barcode" IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_barcode"
      ON "product" ("barcode");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_product_barcode";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_product_barcode_not_null";
    `);
  }
}
