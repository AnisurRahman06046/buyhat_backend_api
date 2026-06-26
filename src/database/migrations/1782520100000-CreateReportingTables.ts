import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * reporting schema (Phase 11): denormalized read-model fact tables maintained by
 * ReportingService seams (no cross-module table reads). `order_fact` (one row
 * per order, unique order_id), `product_sales` (cumulative units per product,
 * unique product_id), `customer_fact` (per-user aggregate, unique user_id).
 * order_id/user_id/product_id are logical cross-module refs (no FK).
 */
export class CreateReportingTables1782520100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reporting"."order_fact" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "order_id" uuid NOT NULL,
        "user_id" uuid,
        "status" varchar(30) NOT NULL,
        "payment_status" varchar(30) NOT NULL,
        "currency" char(3) NOT NULL,
        "subtotal" numeric(12,2) NOT NULL DEFAULT 0,
        "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "grand_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "refunded_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "is_refunded" boolean NOT NULL DEFAULT false,
        "items_count" int NOT NULL DEFAULT 0,
        "placed_at" timestamptz,
        "committed_at" timestamptz NOT NULL
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_order_fact_order" ON "reporting"."order_fact" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_order_fact_committed" ON "reporting"."order_fact" ("committed_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "reporting"."product_sales" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "product_id" uuid NOT NULL,
        "qty_sold" int NOT NULL DEFAULT 0,
        "order_count" int NOT NULL DEFAULT 0,
        "revenue" numeric(14,2) NOT NULL DEFAULT 0,
        "last_sold_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_sales_product" ON "reporting"."product_sales" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_sales_qty" ON "reporting"."product_sales" ("qty_sold")`,
    );

    await queryRunner.query(`
      CREATE TABLE "reporting"."customer_fact" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "registered_at" timestamptz NOT NULL,
        "first_order_at" timestamptz,
        "orders_count" int NOT NULL DEFAULT 0,
        "total_spent" numeric(14,2) NOT NULL DEFAULT 0,
        "last_order_at" timestamptz
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_customer_fact_user" ON "reporting"."customer_fact" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reporting"."customer_fact"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reporting"."product_sales"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reporting"."order_fact"`);
  }
}
