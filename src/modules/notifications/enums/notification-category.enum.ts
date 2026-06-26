/**
 * Message class. TRANSACTIONAL always sends (order/auth/operational);
 * MARKETING honours the recipient's per-channel opt-out (D60).
 */
export enum NotificationCategory {
  TRANSACTIONAL = 'TRANSACTIONAL',
  MARKETING = 'MARKETING',
}
