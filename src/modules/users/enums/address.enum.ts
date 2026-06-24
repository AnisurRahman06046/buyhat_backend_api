/**
 * Address kind — a user may keep separate billing and shipping addresses.
 * Module-local to the users schema.
 */
export enum AddressType {
  BILLING = 'BILLING',
  SHIPPING = 'SHIPPING',
}

/** Account lifecycle for a user record. */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}
