import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * promotions schema: promotion (campaign) + coupon (+ coupon_category,
 * coupon_redemption) + flash_sale (+ flash_sale_item). Unique coupon code,
 * unique (coupon_id, order_id) redemption (idempotent), unique
 * (flash_sale_id, variant_id). Enums stored as varchar.
 */
export class CreatePromotionsTables1782519700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "promotions"."promotion" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(150) NOT NULL,
        "description" text,
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_promotion_active_window" ON "promotions"."promotion" ("is_active", "starts_at", "ends_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "promotions"."coupon" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "code" varchar(50) NOT NULL,
        "promotion_id" uuid REFERENCES "promotions"."promotion"("id") ON DELETE SET NULL,
        "type" varchar(20) NOT NULL,
        "value" numeric(12,2) NOT NULL,
        "min_purchase_amount" numeric(12,2),
        "max_discount_amount" numeric(12,2),
        "usage_limit" int,
        "usage_limit_per_user" int,
        "usage_limit_per_ip" int,
        "used_count" int NOT NULL DEFAULT 0,
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "is_active" boolean NOT NULL DEFAULT true
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_coupon_code" ON "promotions"."coupon" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_coupon_active_window" ON "promotions"."coupon" ("is_active", "starts_at", "ends_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "promotions"."coupon_category" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "coupon_id" uuid NOT NULL REFERENCES "promotions"."coupon"("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_coupon_category" ON "promotions"."coupon_category" ("coupon_id", "category_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "promotions"."coupon_redemption" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "coupon_id" uuid NOT NULL REFERENCES "promotions"."coupon"("id") ON DELETE CASCADE,
        "user_id" uuid,
        "order_id" uuid NOT NULL,
        "discount_amount" numeric(12,2) NOT NULL,
        "ip_address" varchar(64)
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_redemption_coupon_user" ON "promotions"."coupon_redemption" ("coupon_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_redemption_coupon_order" ON "promotions"."coupon_redemption" ("coupon_id", "order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "promotions"."flash_sale" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "name" varchar(150) NOT NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'SCHEDULED'
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_flash_sale_window" ON "promotions"."flash_sale" ("status", "starts_at", "ends_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "promotions"."flash_sale_item" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "flash_sale_id" uuid NOT NULL REFERENCES "promotions"."flash_sale"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "sale_price" numeric(12,2) NOT NULL,
        "quantity_limit" int,
        "sold_count" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_flash_item_variant" ON "promotions"."flash_sale_item" ("flash_sale_id", "variant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_flash_item_variant" ON "promotions"."flash_sale_item" ("variant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "promotions"."flash_sale_item"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"."flash_sale"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "promotions"."coupon_redemption"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "promotions"."coupon_category"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"."coupon"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"."promotion"`);
  }
}
