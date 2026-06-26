import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * reviews schema: review (rating 1..5 via CHECK, moderation status, verified
 * purchase). One active review per (user, product) via a partial-unique index;
 * (product_id, status) index for public listing. product_id/user_id/order_id are
 * logical cross-module refs (no FK). Status enum stored as varchar.
 */
export class CreateReviewsTables1782519900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews"."review" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "user_id" uuid NOT NULL,
        "order_id" uuid,
        "rating" smallint NOT NULL,
        "title" varchar(200),
        "body" text,
        "is_verified_purchase" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'PENDING',
        "helpful_count" int NOT NULL DEFAULT 0,
        CONSTRAINT "chk_review_rating" CHECK ("rating" BETWEEN 1 AND 5)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_review_user_product" ON "reviews"."review" ("user_id", "product_id") WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_review_product_status" ON "reviews"."review" ("product_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"."review"`);
  }
}
