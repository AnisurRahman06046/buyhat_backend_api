import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * orders schema: order + order_item + order_address + order_status_history
 * + order_return + order_return_item. In-schema FKs only; user/variant/product
 * are logical UUID refs. Enums stored as varchar (codebase convention).
 */
export class CreateOrdersTables1782519500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders"."order" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" int NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "order_number" varchar(30) NOT NULL,
        "user_id" uuid,
        "guest_email" varchar(320),
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "payment_status" varchar(20) NOT NULL DEFAULT 'UNPAID',
        "currency" char(3) NOT NULL DEFAULT 'BDT',
        "subtotal" numeric(12,2) NOT NULL,
        "discount_total" numeric(12,2) NOT NULL DEFAULT 0,
        "shipping_total" numeric(12,2) NOT NULL DEFAULT 0,
        "tax_total" numeric(12,2) NOT NULL DEFAULT 0,
        "grand_total" numeric(12,2) NOT NULL,
        "coupon_code" varchar(50),
        "placed_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_order_number" ON "orders"."order" ("order_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_user" ON "orders"."order" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_status" ON "orders"."order" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_payment_status" ON "orders"."order" ("payment_status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders"."order_item" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL REFERENCES "orders"."order"("id") ON DELETE CASCADE,
        "variant_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "sku_snapshot" varchar(80) NOT NULL,
        "product_name_snapshot" varchar(250) NOT NULL,
        "variant_label_snapshot" varchar(250),
        "unit_price" numeric(12,2) NOT NULL,
        "quantity" int NOT NULL,
        "line_total" numeric(12,2) NOT NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_item_order" ON "orders"."order_item" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_item_variant" ON "orders"."order_item" ("variant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders"."order_address" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL REFERENCES "orders"."order"("id") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL,
        "recipient_name" varchar(150) NOT NULL,
        "phone" varchar(20) NOT NULL,
        "line1" varchar(255) NOT NULL,
        "line2" varchar(255),
        "city" varchar(100) NOT NULL,
        "state" varchar(100),
        "postal_code" varchar(20),
        "country" char(2) NOT NULL DEFAULT 'BD'
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_address_order" ON "orders"."order_address" ("order_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders"."order_status_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL REFERENCES "orders"."order"("id") ON DELETE CASCADE,
        "from_status" varchar(20),
        "to_status" varchar(20) NOT NULL,
        "note" text,
        "changed_by" uuid
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_status_history_order" ON "orders"."order_status_history" ("order_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders"."order_return" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "order_id" uuid NOT NULL REFERENCES "orders"."order"("id") ON DELETE CASCADE,
        "status" varchar(20) NOT NULL DEFAULT 'REQUESTED',
        "reason" text,
        "requested_by" uuid
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_return_order" ON "orders"."order_return" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_return_status" ON "orders"."order_return" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "orders"."order_return_item" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "return_id" uuid NOT NULL REFERENCES "orders"."order_return"("id") ON DELETE CASCADE,
        "order_item_id" uuid NOT NULL REFERENCES "orders"."order_item"("id") ON DELETE RESTRICT,
        "quantity" int NOT NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_order_return_item_return" ON "orders"."order_return_item" ("return_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "orders"."order_return_item"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"."order_return"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "orders"."order_status_history"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"."order_address"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"."order_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"."order"`);
  }
}
