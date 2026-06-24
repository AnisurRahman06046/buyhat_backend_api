/**
 * Address kind — a user may keep separate billing and shipping addresses.
 * Module-local to the users schema.
 *
 * NOTE: the Phase-1 DB design favours a generic address + `is_default_shipping`
 * / `is_default_billing` flags over a typed address; this enum is retained for
 * optional address-book categorization. See docs/DATABASE_PHASE1_AUTH_USERS.md.
 */
export enum AddressType {
  BILLING = 'BILLING',
  SHIPPING = 'SHIPPING',
}
