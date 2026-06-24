import { DeleteDateColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Adds soft delete to {@link BaseEntity}. Rows are never hard-deleted by default;
 * `softRemove` / `softDelete` set `deleted_at` and TypeORM automatically excludes
 * deleted rows from queries.
 *
 * Use for ordinary master/mutable tables (category, product, cart, order, …).
 */
export abstract class SoftDeletableEntity extends BaseEntity {
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
