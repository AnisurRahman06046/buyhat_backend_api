/**
 * Physical module boundary: one Postgres schema per module.
 *
 * Every entity pins its module's schema via `@Entity({ schema: SCHEMA.X })`.
 * Cross-module references are plain `uuid` columns (no cross-schema FK), so a
 * module can later be extracted into its own service with `pg_dump -n <schema>`
 * — there is no schema reach-through to untangle.
 *
 * Schemas are created at boot by `DatabaseModule` (CREATE SCHEMA IF NOT EXISTS)
 * and, for migration-based deploys, by the `CreateModuleSchemas` migration.
 */
export const SCHEMA = {
  AUTH: 'auth',
  USERS: 'users',
  CATALOG: 'catalog',
  CART: 'cart',
  ORDERS: 'orders',
  INVENTORY: 'inventory',
  PAYMENTS: 'payments',
  PROMOTIONS: 'promotions',
  CMS: 'cms',
  REVIEWS: 'reviews',
  // Cross-cutting modules (built in later phases; schemas reserved up-front).
  NOTIFICATIONS: 'notifications',
  REPORTING: 'reporting',
  AUDIT: 'audit',
} as const;

export type SchemaName = (typeof SCHEMA)[keyof typeof SCHEMA];

/** All module schemas, used to provision them at boot / in the bootstrap migration. */
export const DB_SCHEMAS: SchemaName[] = Object.values(SCHEMA);
