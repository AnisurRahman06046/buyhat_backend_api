import { MigrationInterface, QueryRunner } from 'typeorm';

/** catalog schema: attributes, options, brands, categories, products, variants. */
export class CreateCatalogTables1782519000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog"."attribute" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(100) NOT NULL,
        "code" varchar(100) NOT NULL,
        "type" varchar(20) NOT NULL,
        "unit" varchar(30),
        "is_variant_defining" boolean NOT NULL DEFAULT false,
        "is_filterable" boolean NOT NULL DEFAULT false
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_attribute_code" ON "catalog"."attribute" ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."attribute_option" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "attribute_id" uuid NOT NULL REFERENCES "catalog"."attribute"("id") ON DELETE CASCADE,
        "value" varchar(150) NOT NULL,
        "label" varchar(150),
        "position" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_attribute_option" ON "catalog"."attribute_option" ("attribute_id", "value")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."brand" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(150) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "logo_url" text,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_brand_slug" ON "catalog"."brand" ("slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."category" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(150) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "description" text,
        "image_url" text,
        "parent_id" uuid REFERENCES "catalog"."category"("id") ON DELETE RESTRICT,
        "position" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_category_slug" ON "catalog"."category" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_category_parent" ON "catalog"."category" ("parent_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."category_attribute" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "category_id" uuid NOT NULL REFERENCES "catalog"."category"("id") ON DELETE CASCADE,
        "attribute_id" uuid NOT NULL REFERENCES "catalog"."attribute"("id") ON DELETE CASCADE,
        "is_required" boolean NOT NULL DEFAULT false,
        "position" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_category_attribute" ON "catalog"."category_attribute" ("category_id", "attribute_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."product" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "name" varchar(250) NOT NULL,
        "slug" varchar(280) NOT NULL,
        "description" text,
        "category_id" uuid NOT NULL REFERENCES "catalog"."category"("id") ON DELETE RESTRICT,
        "brand_id" uuid REFERENCES "catalog"."brand"("id") ON DELETE SET NULL,
        "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
        "base_price" numeric(12,2),
        "currency" char(3) NOT NULL DEFAULT 'BDT',
        "rating_avg" numeric(3,2) NOT NULL DEFAULT 0,
        "rating_count" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_slug" ON "catalog"."product" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_category" ON "catalog"."product" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_brand" ON "catalog"."product" ("brand_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_status" ON "catalog"."product" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."product_attribute_value" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "product_id" uuid NOT NULL REFERENCES "catalog"."product"("id") ON DELETE CASCADE,
        "attribute_id" uuid NOT NULL REFERENCES "catalog"."attribute"("id") ON DELETE RESTRICT,
        "option_id" uuid,
        "value_text" varchar(255)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_attribute_value" ON "catalog"."product_attribute_value" ("product_id", "attribute_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pav_attribute_option" ON "catalog"."product_attribute_value" ("attribute_id", "option_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."product_variant" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "product_id" uuid NOT NULL REFERENCES "catalog"."product"("id") ON DELETE CASCADE,
        "sku" varchar(80) NOT NULL,
        "barcode" varchar(80),
        "price" numeric(12,2) NOT NULL,
        "compare_at_price" numeric(12,2),
        "weight" numeric(8,3),
        "weight_unit" varchar(5) NOT NULL DEFAULT 'kg',
        "is_active" boolean NOT NULL DEFAULT true,
        "attribute_signature" varchar(500) NOT NULL DEFAULT ''
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_variant_sku" ON "catalog"."product_variant" ("sku")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_variant_signature" ON "catalog"."product_variant" ("product_id", "attribute_signature")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_variant_barcode" ON "catalog"."product_variant" ("barcode") WHERE "barcode" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "catalog"."variant_attribute_value" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "variant_id" uuid NOT NULL REFERENCES "catalog"."product_variant"("id") ON DELETE CASCADE,
        "attribute_id" uuid NOT NULL REFERENCES "catalog"."attribute"("id") ON DELETE RESTRICT,
        "option_id" uuid NOT NULL REFERENCES "catalog"."attribute_option"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_variant_attribute_value" ON "catalog"."variant_attribute_value" ("variant_id", "attribute_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'variant_attribute_value',
      'product_variant',
      'product_attribute_value',
      'product',
      'category_attribute',
      'category',
      'brand',
      'attribute_option',
      'attribute',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "catalog"."${table}"`);
    }
  }
}
