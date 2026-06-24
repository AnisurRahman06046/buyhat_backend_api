/**
 * System roles (RBAC). Mirrored by the Postgres enum in the auth schema.
 * Keep in sync with any DB-level enum / seed data.
 */
export enum Role {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  MARKETING_MANAGER = 'MARKETING_MANAGER',
}
