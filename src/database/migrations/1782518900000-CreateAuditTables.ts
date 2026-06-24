import { MigrationInterface, QueryRunner } from 'typeorm';

/** audit schema: append-only audit_log. */
export class CreateAuditTables1782518900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit"."audit_log" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "actor_id" uuid,
        "action" varchar(60) NOT NULL,
        "target_type" varchar(50),
        "target_id" uuid,
        "ip_address" inet,
        "metadata" jsonb
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_actor_created" ON "audit"."audit_log" ("actor_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_action_created" ON "audit"."audit_log" ("action", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit"."audit_log"`);
  }
}
