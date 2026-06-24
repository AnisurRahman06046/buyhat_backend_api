/**
 * Central registry of queue names. Reference these constants instead of raw
 * strings so producers and consumers can never drift apart.
 */
export const QUEUE_NAMES = {
  EXAMPLE: 'example',
  /** Cross-module domain events relayed from each module's transactional outbox. */
  DOMAIN_EVENTS: 'domain-events',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
