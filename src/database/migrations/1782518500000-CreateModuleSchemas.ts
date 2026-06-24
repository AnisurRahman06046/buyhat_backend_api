import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates one Postgres schema per module — the physical module boundary.
 *
 * Kept self-contained (the schema list is inlined, not imported from app code)
 * so this migration remains a stable historical snapshot even if the app's
 * SCHEMA constant changes later. Runs after `InitExtensions`.
 */
const SCHEMAS = [
  'auth',
  'users',
  'catalog',
  'cart',
  'orders',
  'inventory',
  'payments',
  'promotions',
  'cms',
  'reviews',
  'notifications',
  'reporting',
  'audit',
];

export class CreateModuleSchemas1782518500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const schema of SCHEMAS) {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // RESTRICT (not CASCADE) — refuse to drop a schema that still has objects,
    // so a rollback never silently destroys data.
    for (const schema of [...SCHEMAS].reverse()) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schema}" RESTRICT`);
    }
  }
}
