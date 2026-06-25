import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../../common/entities/auditable.entity';
import { SCHEMA } from '../../../database/schemas';

/**
 * Stock for one variant. `available = quantity_on_hand − quantity_reserved`
 * (computed, not stored — D15). `variant_id` is a **logical** ref to
 * `catalog.product_variant.id` (no cross-schema FK). `version` (AuditableEntity)
 * backs safe concurrent mutation; reserve uses an atomic conditional UPDATE (D14).
 */
@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_item' })
export class StockItem extends AuditableEntity {
  @Index('uq_stock_variant', ['variantId'], { unique: true })
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ name: 'quantity_on_hand', type: 'int', default: 0 })
  quantityOnHand: number;

  @Column({ name: 'quantity_reserved', type: 'int', default: 0 })
  quantityReserved: number;

  @Column({ name: 'reorder_level', type: 'int', default: 0 })
  reorderLevel: number;
}
