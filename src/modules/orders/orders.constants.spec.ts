import { OrderStatus } from './enums/order-status.enum';
import { ReturnStatus } from './enums/return-status.enum';
import {
  canTransition,
  CUSTOMER_CANCELLABLE,
  RETURN_FLOW_STATUSES,
  RETURN_TRANSITIONS,
  STAFF_CANCELLABLE,
} from './orders.constants';

describe('order state machine', () => {
  it('allows the happy-path fulfilment chain', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PAID)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PROCESSING, OrderStatus.PACKED)).toBe(true);
    expect(canTransition(OrderStatus.PACKED, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('permits direct PENDING → PAID (e.g. immediate payment)', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PAID)).toBe(true);
  });

  it('rejects illegal jumps and backwards moves', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.PAID)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(
      false,
    );
  });

  it('does not allow cancellation once shipped', () => {
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(
      false,
    );
    expect(STAFF_CANCELLABLE.has(OrderStatus.SHIPPED)).toBe(false);
    expect(STAFF_CANCELLABLE.has(OrderStatus.PACKED)).toBe(true);
  });

  it('limits customer self-cancel to pre-payment statuses', () => {
    expect(CUSTOMER_CANCELLABLE.has(OrderStatus.PENDING)).toBe(true);
    expect(CUSTOMER_CANCELLABLE.has(OrderStatus.CONFIRMED)).toBe(true);
    expect(CUSTOMER_CANCELLABLE.has(OrderStatus.PAID)).toBe(false);
  });

  it('routes return/refund statuses through the returns flow', () => {
    expect(RETURN_FLOW_STATUSES.has(OrderStatus.RETURN_REQUESTED)).toBe(true);
    expect(RETURN_FLOW_STATUSES.has(OrderStatus.RETURNED)).toBe(true);
    expect(RETURN_FLOW_STATUSES.has(OrderStatus.REFUNDED)).toBe(true);
    expect(RETURN_FLOW_STATUSES.has(OrderStatus.CANCELLED)).toBe(false);
  });

  it('supports both full (→RETURNED) and partial (→DELIVERED) return resolution', () => {
    expect(
      canTransition(OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED),
    ).toBe(true);
    expect(
      canTransition(OrderStatus.RETURN_REQUESTED, OrderStatus.RETURNED),
    ).toBe(true);
    expect(
      canTransition(OrderStatus.RETURN_REQUESTED, OrderStatus.DELIVERED),
    ).toBe(true);
    expect(canTransition(OrderStatus.RETURNED, OrderStatus.REFUNDED)).toBe(true);
  });
});

describe('return state machine', () => {
  it('advances REQUESTED → APPROVED → RECEIVED → REFUNDED', () => {
    expect(RETURN_TRANSITIONS[ReturnStatus.REQUESTED]).toContain(
      ReturnStatus.APPROVED,
    );
    expect(RETURN_TRANSITIONS[ReturnStatus.APPROVED]).toContain(
      ReturnStatus.RECEIVED,
    );
    expect(RETURN_TRANSITIONS[ReturnStatus.RECEIVED]).toContain(
      ReturnStatus.REFUNDED,
    );
  });

  it('allows rejecting a requested return but nothing after refund/reject', () => {
    expect(RETURN_TRANSITIONS[ReturnStatus.REQUESTED]).toContain(
      ReturnStatus.REJECTED,
    );
    expect(RETURN_TRANSITIONS[ReturnStatus.REJECTED]).toHaveLength(0);
    expect(RETURN_TRANSITIONS[ReturnStatus.REFUNDED]).toHaveLength(0);
  });
});
