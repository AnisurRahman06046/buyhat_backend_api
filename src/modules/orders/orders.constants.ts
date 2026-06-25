import { Role } from '../../common/enums/role.enum';
import { OrderStatus } from './enums/order-status.enum';
import { ReturnStatus } from './enums/return-status.enum';

/** Staff allowed to list all orders, drive fulfilment, and process returns (D31). */
export const ORDERS_STAFF_ROLES = [Role.ADMIN, Role.CUSTOMER_SUPPORT] as const;

/** Human-readable order-number prefix → `BH-YYYYMMDD-XXXXXX`. */
export const ORDER_NUMBER_PREFIX = 'BH';

/**
 * Allowed order status transitions (the lifecycle state machine).
 * Forward fulfilment + cancellation (pre-shipment) + return/refund branches.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
  // CONFIRMED → PROCESSING lets a COD order (confirmed but unpaid; cash on
  // delivery) enter fulfilment without passing through PAID.
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  // RETURN_REQUESTED can resolve back to DELIVERED (return rejected) or RETURNED.
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED, OrderStatus.DELIVERED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/** True when `to` is a legal next status from `from`. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Statuses owned by the returns flow — they must be driven via the returns
 * endpoints, not the generic staff status PATCH.
 */
export const RETURN_FLOW_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURNED,
  OrderStatus.REFUNDED,
]);

/** Statuses at which a customer may still cancel their own order (pre-payment). */
export const CUSTOMER_CANCELLABLE: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
]);

/** Statuses at which staff may cancel (pre-shipment). */
export const STAFF_CANCELLABLE: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
]);

/** Allowed return status transitions. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.REQUESTED]: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
  [ReturnStatus.APPROVED]: [ReturnStatus.RECEIVED],
  [ReturnStatus.RECEIVED]: [ReturnStatus.REFUNDED],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.REFUNDED]: [],
};
