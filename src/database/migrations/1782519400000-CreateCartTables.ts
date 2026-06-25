import { MigrationInterface, QueryRunner } from 'typeorm';

/** cart schema: cart + cart_item, with partial-unique one-ACTIVE-cart-per-identity. */
export class CreateCartTables1782519400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cart"."cart" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "user_id" uuid,
        "guest_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "currency" char(3) NOT NULL DEFAULT 'BDT',
        "coupon_code" varchar(50),
        "last_activity_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cart_active_user" ON "cart"."cart" ("user_id") WHERE "status" = 'ACTIVE' AND "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cart_active_guest" ON "cart"."cart" ("guest_id") WHERE "status" = 'ACTIVE' AND "guest_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cart_status_activity" ON "cart"."cart" ("status", "last_activity_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "cart"."cart_item" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "cart_id" uuid NOT NULL REFERENCES "cart"."cart"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "unit_price_snapshot" numeric(12,2) NOT NULL,
        "product_name_snapshot" varchar(250) NOT NULL
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_cart_item_variant" ON "cart"."cart_item" ("cart_id", "variant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cart"."cart_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart"."cart"`);
  }
}
