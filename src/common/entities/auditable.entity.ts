import { Column, DeleteDateColumn, VersionColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Base for mutable domain "master" tables (the user-owned, edited-over-time
 * records such as account, profile, address). On top of {@link BaseEntity} it
 * adds the full audit/concurrency block:
 *
 * - **deletedAt** — soft delete. TypeORM hides these rows from normal queries
 *   (`softDelete`/`softRemove`); nothing is physically destroyed, which keeps
 *   downstream references (orders, payments) intact and supports a later
 *   GDPR anonymization pass.
 * - **createdBy / updatedBy** — the acting `user_id`. These are **logical**
 *   references (no cross-schema FK, per the modular-monolith rule); `null`
 *   means a system or self-service action.
 * - **version** — optimistic concurrency. TypeORM bumps it on every save and
 *   throws on a stale write, so two concurrent edits to the same row can never
 *   silently clobber one another.
 *
 * Ephemeral/security tables (refresh tokens, one-time tokens, outbox events)
 * intentionally stay on {@link BaseEntity}: they are never soft-deleted or
 * version-checked — they expire and are pruned by cleanup jobs.
 */
export abstract class AuditableEntity extends BaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn()
  version: number;
}
