import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyTransformer } from '../../../common/entities/money.transformer';
import { SCHEMA } from '../../../database/schemas';
import { Cart } from './cart.entity';

/**
 * One line of a cart — a variant + quantity, with a **price/name snapshot** taken
 * from catalog at add time (re-validated on read, D21). Unique `(cart_id,
 * variant_id)` keeps one line per variant. `variant_id`/`product_id` are logical
 * refs to catalog.
 */
@Entity({ schema: SCHEMA.CART, name: 'cart_item' })
@Index('uq_cart_item_variant', ['cartId', 'variantId'], { unique: true })
export class CartItem extends BaseEntity {
  @Column({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({
    name: 'unit_price_snapshot',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  unitPriceSnapshot: number;

  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 250 })
  productNameSnapshot: string;
}
