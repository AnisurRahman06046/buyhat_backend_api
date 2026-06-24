/**
 * Account lifecycle status. Lives in the **auth** module because it gates
 * whether an account may authenticate — not a profile/display concern. Mirrors
 * the Postgres `auth.account_status` enum type and backs `auth.account.status`.
 *
 * (Relocated from the users module: status is an authentication concern. The
 * users `profile` carries no status field.)
 */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}
