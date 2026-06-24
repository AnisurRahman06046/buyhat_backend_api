import { MigrationInterface, QueryRunner } from 'typeorm';
import { DB_SCHEMAS } from '../db.constants';

/**
 * First migration: create one Postgres schema per module. Must run before any
 * table migration (subsequent migrations create tables inside these schemas).
 */
export class CreateModuleSchemas1700000000000 implements MigrationInterface {
  name = 'CreateModuleSchemas1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const schema of DB_SCHEMAS) {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // RESTRICT: refuse to drop a schema that still contains objects (safe by default).
    for (const schema of DB_SCHEMAS) {
      await queryRunner.query(`DROP SCHEMA IF EXISTS "${schema}" RESTRICT`);
    }
  }
}
