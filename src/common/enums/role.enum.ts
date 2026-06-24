/**
 * Application roles for RBAC. A user (account) may hold several — the JWT carries
 * the full `roles[]` array and `RolesGuard` grants access if any required role
 * is present.
 */
export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  MARKETING_MANAGER = 'MARKETING_MANAGER',
}
