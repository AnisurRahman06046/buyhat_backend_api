/** Stable, machine-readable audit action codes. */
export const AuditAction = {
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  ACCOUNT_STATUS_CHANGED: 'account.status_changed',
  ACCOUNT_ROLES_CHANGED: 'account.roles_changed',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
