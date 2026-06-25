import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { StockMovementType } from '../enums/stock-movement-type.enum';

/**
 * Append-only stock ledger (edge case #9): every quantity change writes exactly
 * one row, never updated or deleted. `quantity` is a signed delta and
 * `balance_after` is the resulting `quantity_on_hand`, so history is auditable
 * and reconstructable.
 */
@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_movement' })
@Index(['variantId', 'createdAt'])
@Index(['referenceType', 'referenceId'])
export class StockMovement extends BaseEntity {
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ type: 'varchar', length: 20 })
  type: StockMovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
