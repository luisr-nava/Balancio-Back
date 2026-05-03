import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketFeatureColumns1743000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "ticket_configuration_status" AS ENUM ('not_started', 'partial', 'ready');
    `);

    await queryRunner.query(`
      ALTER TABLE "shop_ticket_settings"
      ADD COLUMN IF NOT EXISTS "ticketsEnabled" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "shop_ticket_settings"
      ADD COLUMN IF NOT EXISTS "configurationStatus" "ticket_configuration_status" NOT NULL DEFAULT 'not_started';
    `);

    await queryRunner.query(`
      UPDATE "shop_ticket_settings"
      SET "configurationStatus" = CASE
        WHEN "paperSize" IS NOT NULL AND "layout" IS NOT NULL THEN 'ready'::"ticket_configuration_status"
        WHEN "paperSize" IS NOT NULL OR "layout" IS NOT NULL THEN 'partial'::"ticket_configuration_status"
        ELSE 'not_started'::"ticket_configuration_status"
      END;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shop_ticket_settings"
      DROP COLUMN IF EXISTS "configurationStatus";
    `);

    await queryRunner.query(`
      ALTER TABLE "shop_ticket_settings"
      DROP COLUMN IF EXISTS "ticketsEnabled";
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "ticket_configuration_status";
    `);
  }
}
