/**
 * Lifecycle state of an account. Gates authentication:
 * PENDING_VERIFICATION & ACTIVE may log in; SUSPENDED & DEACTIVATED may not.
 */
export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}
