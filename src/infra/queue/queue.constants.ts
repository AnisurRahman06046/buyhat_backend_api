/**
 * Background job queues (BullMQ). Each maps to an async workflow from the
 * BuyHat spec — abandoned-cart reminders, payment reconciliation, stock
 * reservation expiry, notification fan-out, reporting roll-ups.
 */
export const QUEUE = {
  NOTIFICATIONS: 'notifications',
  ABANDONED_CART: 'abandoned-cart',
  PAYMENT_RECONCILIATION: 'payment-reconciliation',
  INVENTORY_RESERVATION: 'inventory-reservation',
  REPORTING_ROLLUP: 'reporting-rollup',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export const ALL_QUEUES: readonly QueueName[] = Object.values(QUEUE);
