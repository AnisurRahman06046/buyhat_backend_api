import { Column, Entity, Index, OneToMany } from 'typeorm';
import { SoftDeletableEntity } from '../../../common/entities/soft-deletable.entity';
import { SCHEMA } from '../../../database/schemas';
import { CartStatus } from '../enums/cart-status.enum';
import { CartItem } from './cart-item.entity';

/**
 * A shopping cart for a logged-in user (`user_id`) or a guest (`guest_id`). The
 * partial-unique indexes guarantee at most one ACTIVE cart per identity.
 * `user_id`/`guest_id` are logical refs (no cross-schema FK). `last_activity_at`
 * drives the abandoned-cart sweeper (D23).
 */
@Entity({ schema: SCHEMA.CART, name: 'cart' })
@Index('uq_cart_active_user', ['userId'], {
  unique: true,
  where: `"status" = 'ACTIVE' AND "user_id" IS NOT NULL`,
})
@Index('uq_cart_active_guest', ['guestId'], {
  unique: true,
  where: `"status" = 'ACTIVE' AND "guest_id" IS NOT NULL`,
})
@Index(['status', 'lastActivityAt'])
export class Cart extends SoftDeletableEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'guest_id', type: 'uuid', nullable: true })
  guestId: string | null;

  @Column({ type: 'varchar', length: 20, default: CartStatus.ACTIVE })
  status: CartStatus;

  @Column({ type: 'char', length: 3, default: 'BDT' })
  currency: string;

  @Column({ name: 'coupon_code', type: 'varchar', length: 50, nullable: true })
  couponCode: string | null;

  @Column({
    name: 'last_activity_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastActivityAt: Date;

  // No cascade: items are persisted via their own repository. Cascading here
  // would let a stale in-memory items array overwrite line changes on cart save.
  @OneToMany(() => CartItem, (item) => item.cart)
  items: CartItem[];
}
