import { Column, VersionColumn } from 'typeorm';
import { SoftDeletableEntity } from './soft-deletable.entity';

/**
 * Adds an optimistic-lock `version` and authorship columns to
 * {@link SoftDeletableEntity}.
 *
 * - `version` — TypeORM increments it on every save and rejects a save built
 *   from a stale copy, preventing lost updates under concurrency (critical for
 *   stock, orders, payments).
 * - `created_by` / `updated_by` — the acting user's id (a **logical** uuid,
 *   never a cross-module FK).
 *
 * Use for contended aggregate roots (account, product, variant, stock_item,
 * order, payment, …).
 */
export abstract class AuditableEntity extends SoftDeletableEntity {
  @VersionColumn({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;
}
