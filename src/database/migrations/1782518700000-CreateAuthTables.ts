import { MigrationInterface, QueryRunner } from 'typeorm';

/** auth schema: account, account_role, one_time_token, outbox_event. */
export class CreateAuthTables1782518700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth"."account" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "email" citext NOT NULL,
        "password_hash" varchar,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
        "email_verified_at" timestamptz,
        "last_login_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_account_email_active" ON "auth"."account" ("email") WHERE "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth"."account_role" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "account_id" uuid NOT NULL REFERENCES "auth"."account"("id") ON DELETE CASCADE,
        "role" varchar(30) NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_account_role" ON "auth"."account_role" ("account_id", "role")`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth"."one_time_token" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "account_id" uuid NOT NULL REFERENCES "auth"."account"("id") ON DELETE CASCADE,
        "purpose" varchar(30) NOT NULL,
        "token_hash" varchar(128) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_one_time_token_hash" ON "auth"."one_time_token" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_one_time_token_account_purpose" ON "auth"."one_time_token" ("account_id", "purpose")`,
    );

    await queryRunner.query(`
      CREATE TABLE "auth"."outbox_event" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "aggregate_type" varchar(50) NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "attempts" integer NOT NULL DEFAULT 0,
        "published_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_status_created" ON "auth"."outbox_event" ("status", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."outbox_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."one_time_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."account_role"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auth"."account"`);
  }
}
