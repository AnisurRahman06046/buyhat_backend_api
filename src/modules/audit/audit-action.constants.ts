/** Stable, machine-readable audit action codes. */
export const AuditAction = {
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  ACCOUNT_STATUS_CHANGED: 'account.status_changed',
  ACCOUNT_ROLES_CHANGED: 'account.roles_changed',
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_RETURN_REQUESTED: 'order.return_requested',
  ORDER_RETURNED: 'order.returned',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_REFUNDED: 'payment.refunded',
  REVIEW_CREATED: 'review.created',
  REVIEW_MODERATED: 'review.moderated',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
