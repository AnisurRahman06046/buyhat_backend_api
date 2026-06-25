import { MigrationInterface, QueryRunner } from 'typeorm';

/** inventory schema: stock_item, stock_movement (ledger), stock_reservation. */
export class CreateInventoryTables1782519300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory"."stock_item" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "variant_id" uuid NOT NULL,
        "quantity_on_hand" int NOT NULL DEFAULT 0,
        "quantity_reserved" int NOT NULL DEFAULT 0,
        "reorder_level" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_stock_variant" ON "inventory"."stock_item" ("variant_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory"."stock_movement" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "variant_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "quantity" int NOT NULL,
        "balance_after" int NOT NULL,
        "reference_type" varchar(30),
        "reference_id" uuid,
        "reason" varchar(255),
        "created_by" uuid
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movement_variant" ON "inventory"."stock_movement" ("variant_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_stock_movement_reference" ON "inventory"."stock_movement" ("reference_type", "reference_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "inventory"."stock_reservation" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "variant_id" uuid NOT NULL,
        "quantity" int NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'HELD',
        "cart_id" uuid,
        "order_id" uuid,
        "expires_at" timestamptz NOT NULL
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_reservation_status_expiry" ON "inventory"."stock_reservation" ("status", "expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reservation_cart" ON "inventory"."stock_reservation" ("cart_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reservation_order" ON "inventory"."stock_reservation" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['stock_reservation', 'stock_movement', 'stock_item']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "inventory"."${table}"`);
    }
  }
}
