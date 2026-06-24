import { MigrationInterface, QueryRunner } from 'typeorm';

/** Enable `citext` for case-insensitive email columns. */
export class AddCitextExtension1782518600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS citext;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS citext;');
  }
}
