import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * payments schema: payment + payment_transaction (append-only) + refund.
 * Unique idempotency_key (initiate) and unique gateway_txn_id (webhook dedupe)
 * make retries/callbacks safe (edge case #2). Enums stored as varchar.
 */
export class CreatePaymentsTables1782519600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments"."payment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "version" int NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "order_id" uuid NOT NULL,
        "user_id" uuid,
        "gateway" varchar(20) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'BDT',
        "status" varchar(20) NOT NULL DEFAULT 'INITIATED',
        "idempotency_key" varchar(100) NOT NULL,
        "gateway_reference" varchar(150)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_idempotency_key" ON "payments"."payment" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_order" ON "payments"."payment" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_payment_status" ON "payments"."payment" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "payments"."payment_transaction" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "payment_id" uuid NOT NULL REFERENCES "payments"."payment"("id") ON DELETE CASCADE,
        "type" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "gateway_txn_id" varchar(150),
        "raw_payload" jsonb
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_payment_txn_payment" ON "payments"."payment_transaction" ("payment_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_txn_gateway_id" ON "payments"."payment_transaction" ("gateway_txn_id") WHERE "gateway_txn_id" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "payments"."refund" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "payment_id" uuid NOT NULL REFERENCES "payments"."payment"("id") ON DELETE RESTRICT,
        "order_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "reason" text,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "gateway_refund_id" varchar(150)
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_refund_order" ON "payments"."refund" ("order_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refund_status" ON "payments"."refund" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"."refund"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "payments"."payment_transaction"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"."payment"`);
  }
}
