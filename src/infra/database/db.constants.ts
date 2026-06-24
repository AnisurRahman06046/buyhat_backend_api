/**
 * One Postgres schema per module — the physical boundary that keeps each
 * module's tables isolated and makes future microservice extraction a
 * `pg_dump -n <schema>` away. Entities reference these via @Entity({ schema }).
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
  NOTIFICATIONS: 'notifications',
  REVIEWS: 'reviews',
  REPORTING: 'reporting',
  AUDIT: 'audit',
} as const;

export type SchemaName = (typeof SCHEMA)[keyof typeof SCHEMA];

export const DB_SCHEMAS: readonly SchemaName[] = Object.values(SCHEMA);
