import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleCashReceivedColumns1743100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale"
      ADD COLUMN IF NOT EXISTS "amountReceived" decimal(12,2) DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "sale"
      ADD COLUMN IF NOT EXISTS "change" decimal(12,2) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sale" DROP COLUMN IF EXISTS "change"
    `);

    await queryRunner.query(`
      ALTER TABLE "sale" DROP COLUMN IF EXISTS "amountReceived"
    `);
  }
}
