import { MigrationInterface, QueryRunner } from 'typeorm';

/** catalog.outbox_event — catalog's transactional outbox (D13: per-module). */
export class CreateCatalogOutbox1782519200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog"."outbox_event" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "aggregate_type" varchar(50) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "published_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_catalog_outbox_status" ON "catalog"."outbox_event" ("status", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog"."outbox_event"`);
  }
}
