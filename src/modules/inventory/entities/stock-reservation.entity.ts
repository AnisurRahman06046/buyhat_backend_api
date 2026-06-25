import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SCHEMA } from '../../../database/schemas';
import { ReservationStatus } from '../enums/reservation-status.enum';

/**
 * A temporary hold on stock for a cart/order. `cart_id`/`order_id` are nullable
 * **logical** refs (cart=Phase 4, orders=Phase 5). Expiry is driven by a BullMQ
 * delayed job with a periodic sweeper backstop (D16); the `(status, expires_at)`
 * index serves the sweeper.
 */
@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_reservation' })
@Index(['status', 'expiresAt'])
@Index(['cartId'])
@Index(['orderId'])
export class StockReservation extends BaseEntity {
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 20, default: ReservationStatus.HELD })
  status: ReservationStatus;

  @Column({ name: 'cart_id', type: 'uuid', nullable: true })
  cartId: string | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
