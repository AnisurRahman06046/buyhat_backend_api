import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * cms schema: homepage_section (ordered blocks) + cms_banner (incl. hero slides
 * via placement) + cms_popup + landing_page (unique slug). Enums stored as
 * varchar. CMS rows reference catalog ids only logically (in JSONB config) — no
 * cross-schema FK.
 */
export class CreateCmsTables1782519800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cms"."homepage_section" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "type" varchar(30) NOT NULL,
        "title" varchar(150),
        "position" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "config" jsonb NOT NULL DEFAULT '{}'
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_homepage_section_active_position" ON "cms"."homepage_section" ("is_active", "position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cms"."cms_banner" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "title" varchar(150),
        "image_url" text NOT NULL,
        "mobile_image_url" text,
        "cta_text" varchar(80),
        "cta_url" text,
        "placement" varchar(20) NOT NULL,
        "position" int NOT NULL DEFAULT 0,
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_cms_banner_placement_active_position" ON "cms"."cms_banner" ("placement", "is_active", "position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cms"."cms_popup" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "title" varchar(150) NOT NULL,
        "content" text,
        "image_url" text,
        "cta_text" varchar(80),
        "cta_url" text,
        "trigger" varchar(20) NOT NULL DEFAULT 'ON_LOAD',
        "delay_seconds" int NOT NULL DEFAULT 0,
        "frequency" varchar(20) NOT NULL DEFAULT 'ONCE',
        "audience" varchar(20) NOT NULL DEFAULT 'EVERYONE',
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_cms_popup_active_window" ON "cms"."cms_popup" ("is_active", "starts_at", "ends_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cms"."landing_page" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "slug" varchar(180) NOT NULL,
        "title" varchar(200) NOT NULL,
        "content" jsonb NOT NULL DEFAULT '{}',
        "seo_title" varchar(200),
        "seo_description" varchar(300),
        "is_published" boolean NOT NULL DEFAULT false
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_landing_page_slug" ON "cms"."landing_page" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cms"."landing_page"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cms"."cms_popup"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cms"."cms_banner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cms"."homepage_section"`);
  }
}
