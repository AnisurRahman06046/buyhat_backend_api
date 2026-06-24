import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Root persistence base: a surrogate UUID primary key plus creation/update
 * timestamps. Every domain table that uses a single-column surrogate key
 * extends this — directly (ephemeral/security tables) or via
 * {@link AuditableEntity} (mutable domain "master" tables).
 *
 * The id is a time-ordered **UUIDv7** generated in the application layer so
 * primary-key inserts stay near-sequential. That keeps the B-tree compact and
 * avoids the page-split churn random UUIDv4 causes under high insert volume —
 * the single most impactful PK choice for write-heavy tables at scale. A
 * `gen_random_uuid()` column default is kept only as a safety net for inserts
 * that bypass the entity lifecycle (e.g. raw query builder).
 *
 * Association tables with composite keys (e.g. `user_role`) and pure read
 * models legitimately opt out of this base — do not force a surrogate id on
 * them just for uniformity (ISP).
 */
export abstract class BaseEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  protected assignId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
