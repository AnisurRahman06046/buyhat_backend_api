import { MigrationInterface, QueryRunner } from 'typeorm';

/** catalog.product_media — images/videos for products & variants (Phase 2 media). */
export class CreateCatalogMedia1782519100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalog"."product_media" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "product_id" uuid NOT NULL REFERENCES "catalog"."product"("id") ON DELETE CASCADE,
        "variant_id" uuid REFERENCES "catalog"."product_variant"("id") ON DELETE SET NULL,
        "type" varchar(20) NOT NULL DEFAULT 'IMAGE',
        "storage_key" varchar(500),
        "url" text,
        "alt" varchar(200),
        "is_primary" boolean NOT NULL DEFAULT false,
        "position" int NOT NULL DEFAULT 0
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_product_media_product" ON "catalog"."product_media" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_media_variant" ON "catalog"."product_media" ("variant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_product_primary_media" ON "catalog"."product_media" ("product_id") WHERE "is_primary" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "catalog"."product_media"`);
  }
}
