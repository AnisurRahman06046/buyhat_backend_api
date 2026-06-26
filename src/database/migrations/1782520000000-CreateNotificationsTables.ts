import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * notifications schema (Phase 10): an append-only `notification` delivery log,
 * `notification_template` (DB overrides of in-code defaults, unique per
 * event+channel), and `notification_preference` (per-user marketing opt-out,
 * unique per user). user_id is a logical cross-module ref (no FK). Enums stored
 * as varchar. Soft-deletable tables use partial-unique indexes (WHERE
 * deleted_at IS NULL), matching the rest of the codebase.
 */
export class CreateNotificationsTables1782520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications"."notification" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid,
        "channel" varchar(20) NOT NULL,
        "recipient" varchar(320) NOT NULL,
        "event" varchar(100) NOT NULL,
        "category" varchar(20) NOT NULL,
        "subject" varchar(300),
        "body" text NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "error" text,
        "provider" varchar(50),
        "sent_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_notification_status" ON "notifications"."notification" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_user" ON "notifications"."notification" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications"."notification_template" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "event" varchar(100) NOT NULL,
        "channel" varchar(20) NOT NULL,
        "subject" varchar(300),
        "body" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_notification_template_event_channel" ON "notifications"."notification_template" ("event", "channel") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications"."notification_preference" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "user_id" uuid NOT NULL,
        "marketing_email" boolean NOT NULL DEFAULT true,
        "marketing_sms" boolean NOT NULL DEFAULT true,
        "marketing_push" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_notification_preference_user" ON "notifications"."notification_preference" ("user_id") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notifications"."notification_preference"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notifications"."notification_template"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notifications"."notification"`,
    );
  }
}
