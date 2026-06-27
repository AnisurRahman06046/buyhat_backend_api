import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 12 search support: a generated `search_vector` (name + description) with
 * a GIN index for full-text ranking, an (attribute_id, option_id) index on
 * variant_attribute_value for variant-attribute facets, and a base_price index
 * for the price keyset sort. (product_attribute_value already has
 * idx_pav_attribute_option.) The column is generated/maintained by Postgres, so
 * the ORM never writes it.
 */
export class AddProductSearch1782520200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalog"."product"
         ADD COLUMN "search_vector" tsvector
         GENERATED ALWAYS AS (
           to_tsvector('english',
             coalesce("name", '') || ' ' || coalesce("description", ''))
         ) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_search_vector" ON "catalog"."product" USING GIN ("search_vector")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_vav_attribute_option" ON "catalog"."variant_attribute_value" ("attribute_id", "option_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_product_base_price" ON "catalog"."product" ("base_price")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "catalog"."idx_product_base_price"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "catalog"."idx_vav_attribute_option"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "catalog"."idx_product_search_vector"`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalog"."product" DROP COLUMN IF EXISTS "search_vector"`,
    );
  }
}
