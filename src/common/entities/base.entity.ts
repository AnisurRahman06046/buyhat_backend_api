import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Root of the entity hierarchy: a UUID primary key + audit timestamps.
 *
 * - UUID PK — safe to expose, hard to enumerate, microservice-friendly.
 * - `created_at` / `updated_at` managed automatically by TypeORM.
 *
 * Use this directly for **append-only** tables (ledgers, history, transaction
 * logs) that must NOT be soft-deleted or mutated. For ordinary master tables use
 * {@link SoftDeletableEntity}; for contended aggregates use {@link AuditableEntity}.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
