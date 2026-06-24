import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * First migration — enable the Postgres extensions the schema depends on.
 *
 * `@PrimaryGeneratedColumn('uuid')` makes TypeORM emit `uuid_generate_v4()`,
 * which requires `uuid-ossp`. On a clean database without this extension every
 * insert/migration that creates a UUID default fails at runtime. `pgcrypto`
 * (for `gen_random_uuid()`) is enabled too so either default works.
 */
export class InitExtensions1782518400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto";');
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
  }
}
