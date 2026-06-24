import { MigrationInterface, QueryRunner } from 'typeorm';

/** users schema: profile, address. `user_id` is a logical ref to auth.account (no FK). */
export class CreateUsersTables1782518800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users"."profile" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "user_id" uuid NOT NULL,
        "first_name" varchar(100),
        "last_name" varchar(100),
        "display_name" varchar(150),
        "phone" varchar(20),
        "avatar_url" text,
        "locale" varchar(10) NOT NULL DEFAULT 'en',
        "currency" char(3) NOT NULL DEFAULT 'BDT',
        "marketing_opt_in" boolean NOT NULL DEFAULT false,
        "preferences" jsonb NOT NULL DEFAULT '{}'
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_profile_user" ON "users"."profile" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_profile_phone_active" ON "users"."profile" ("phone") WHERE "phone" IS NOT NULL AND "deleted_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "users"."address" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "profile_id" uuid NOT NULL REFERENCES "users"."profile"("id") ON DELETE CASCADE,
        "label" varchar(50),
        "recipient_name" varchar(150) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "line1" varchar(255) NOT NULL,
        "line2" varchar(255),
        "city" varchar(100) NOT NULL,
        "state" varchar(100),
        "postal_code" varchar(20),
        "country" char(2) NOT NULL DEFAULT 'BD',
        "is_default_shipping" boolean NOT NULL DEFAULT false,
        "is_default_billing" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_address_profile" ON "users"."address" ("profile_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_address_default_shipping" ON "users"."address" ("profile_id") WHERE "is_default_shipping" = true AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_address_default_billing" ON "users"."address" ("profile_id") WHERE "is_default_billing" = true AND "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."address"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"."profile"`);
  }
}
