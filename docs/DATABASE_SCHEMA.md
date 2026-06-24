# BuyHat — Full Database Schema (TypeORM / PostgreSQL)

> Schema design for the modular-monolith e-commerce backend. **TypeORM**, not
> Prisma (project standard — see the TypeORM-over-Prisma decision). This is the
> design reference; entities are implemented module-by-module with migrations
> across Phases 1–7 of `PROJECT_PLAN.md`.
>
> **Date:** 2026-06-24 · **Modules covered:** auth, users, catalog, cart,
> orders, inventory, payments, promotions, cms, reviews.

---

## 1. Conventions (apply to every entity)

| Concern | Rule |
| --- | --- |
| **Primary key** | UUID (`@PrimaryGeneratedColumn('uuid')`, default `uuid_generate_v4()`; `pgcrypto`/`gen_random_uuid()` also available — enabled by the `InitExtensions` migration). Safe to expose, non-enumerable, microservice-friendly. |
| **Module isolation** | One Postgres schema per module: `@Entity({ schema: SCHEMA.x })`. A hard physical boundary → `pg_dump -n <schema>` to extract a service. *(Open decision D1 — drop `schema:` to fall back to a single `public` schema; the rest of the design is identical.)* |
| **Cross-module references** | Stored as plain **indexed `uuid` columns** (`userId`, `variantId`, `orderId` …) with **no cross-schema FK**. FKs (`@ManyToOne`/`@OneToMany`) are used **only within a module's own schema**. |
| **Timestamps** | `created_at` + `updated_at` (`timestamptz`) on every table via `BaseEntity`. |
| **Soft delete** | `deleted_at` on master/mutable tables (`SoftDeletableEntity`). **Append-only ledgers/history tables do NOT soft-delete** and are immutable. |
| **Optimistic locking** | `version` column (`AuditableEntity`) on hotly-contended aggregates (product, variant, stock, order, payment) to prevent lost updates under concurrency. |
| **Money** | `numeric(12,2)` with a string⇄number transformer (TypeORM returns `numeric` as `string`). Currency stored as ISO 4217 (`char(3)`, default `BDT`). |
| **Naming** | `snake_case` columns (`name:` on each `@Column`), singular table names (schema namespaces remove the need for a module prefix). |
| **Enums** | Native PG enum types, declared per module. |
| **Indexes** | Every FK/logical-ref column, every unique business key (slug, sku, email, order_number, coupon code), and every hot filter (status, is_active, expires_at) is indexed. See §13. |

### Base classes (`src/common/entities`)

```ts
// base.entity.ts — id + timestamps (all tables)
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

// soft-deletable.entity.ts — adds soft delete (master/mutable tables)
export abstract class SoftDeletableEntity extends BaseEntity {
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

// auditable.entity.ts — adds optimistic lock + authorship (contended aggregates)
export abstract class AuditableEntity extends SoftDeletableEntity {
  @VersionColumn({ name: 'version', default: 1 }) version: number;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
}

// money transformer used by all numeric(12,2) columns
export const moneyTransformer = {
  to: (v?: number) => v,
  from: (v?: string) => (v == null ? v : parseFloat(v)),
};
```

> The current scaffold's `BaseEntity` bundles `deleted_at`. The refinement above
> **splits** it so append-only ledger tables don't inherit soft delete — a small
> Phase-0 refactor. `SCHEMA` is a constants object (`{ AUTH:'auth', USERS:'users', … }`).

---

## 2. AUTH module (schema `auth`)

Owns identity, credentials, roles, verification/reset tokens. **Refresh-token
rotation state lives in Redis** (already implemented in Phase 0 via
`RefreshTokenStore`), so there is no refresh-token table — only a persistent
one-time-token table for email verification / password reset / OTP.

```ts
export enum AccountStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}
export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  INVENTORY_MANAGER = 'INVENTORY_MANAGER',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  MARKETING_MANAGER = 'MARKETING_MANAGER',
}
export enum OneTimeTokenPurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
  OTP_LOGIN = 'OTP_LOGIN',
}

@Entity({ schema: SCHEMA.AUTH, name: 'account' })
@Index('uq_account_email_active', ['email'], { unique: true, where: '"deleted_at" IS NULL' })
export class Account extends AuditableEntity {
  // citext recommended for case-insensitive uniqueness (enable in a migration)
  @Column({ type: 'varchar', length: 320 }) email: string;
  @Column({ name: 'password_hash', type: 'varchar', select: false, nullable: true })
  passwordHash: string | null;            // nullable → social login later
  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING_VERIFICATION })
  status: AccountStatus;
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => AccountRole, (r) => r.account) roles: AccountRole[];
}

// M:N roles — a user can hold several (Admin + Inventory Manager). JWT carries roles[].
@Entity({ schema: SCHEMA.AUTH, name: 'account_role' })
@Index(['accountId', 'role'], { unique: true })
export class AccountRole extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' }) accountId: string;
  @ManyToOne(() => Account, (a) => a.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' }) account: Account;
  @Column({ type: 'enum', enum: Role }) role: Role;
}

@Entity({ schema: SCHEMA.AUTH, name: 'one_time_token' })
@Index(['accountId', 'purpose'])
export class OneTimeToken extends BaseEntity {
  @Column({ name: 'account_id', type: 'uuid' }) accountId: string;
  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' }) account: Account;
  @Column({ type: 'enum', enum: OneTimeTokenPurpose }) purpose: OneTimeTokenPurpose;
  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar' }) tokenHash: string;   // never the raw token
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt: Date | null;
}
```

**Relationships:** `Account 1—N AccountRole` (in-schema FK, cascade); `Account
1—N OneTimeToken` (in-schema FK, cascade). `account.id` is the **global user id**
(= JWT `sub`) every other module references logically.

---

## 3. USERS module (schema `users`)

Owns the customer profile + addresses. **Email is NOT duplicated here** — it lives
only in `auth.account` (single source of truth). `profile.user_id` is a logical
1:1 to `auth.account.id` (no cross-schema FK), populated idempotently from the
`user.registered` outbox event.

```ts
@Entity({ schema: SCHEMA.USERS, name: 'profile' })
@Index('uq_profile_user', ['userId'], { unique: true })
@Index('uq_profile_phone_active', ['phone'], { unique: true, where: '"phone" IS NOT NULL AND "deleted_at" IS NULL' })
export class Profile extends AuditableEntity {
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;          // → auth.account.id (logical)
  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true }) firstName: string | null;
  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true }) lastName: string | null;
  @Column({ name: 'display_name', type: 'varchar', length: 150, nullable: true }) displayName: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;   // E.164
  @Column({ name: 'avatar_url', type: 'text', nullable: true }) avatarUrl: string | null;
  @Column({ type: 'varchar', length: 10, default: 'en' }) locale: string;
  @Column({ type: 'char', length: 3, default: 'BDT' }) currency: string;
  @Column({ name: 'marketing_opt_in', type: 'boolean', default: false }) marketingOptIn: boolean;
  @Column({ type: 'jsonb', default: {} }) preferences: Record<string, unknown>;

  @OneToMany(() => Address, (a) => a.profile) addresses: Address[];
}

@Entity({ schema: SCHEMA.USERS, name: 'address' })
@Index('uq_address_default_shipping', ['profileId'], { unique: true, where: '"is_default_shipping" = true AND "deleted_at" IS NULL' })
@Index('uq_address_default_billing', ['profileId'], { unique: true, where: '"is_default_billing" = true AND "deleted_at" IS NULL' })
export class Address extends SoftDeletableEntity {
  @Column({ name: 'profile_id', type: 'uuid' }) profileId: string;
  @ManyToOne(() => Profile, (p) => p.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' }) profile: Profile;
  @Column({ type: 'varchar', length: 50, nullable: true }) label: string | null;     // "Home", "Office"
  @Column({ name: 'recipient_name', type: 'varchar', length: 150 }) recipientName: string;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ name: 'line1', type: 'varchar', length: 255 }) line1: string;
  @Column({ name: 'line2', type: 'varchar', length: 255, nullable: true }) line2: string | null;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) state: string | null;
  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true }) postalCode: string | null;
  @Column({ type: 'char', length: 2, default: 'BD' }) country: string;
  @Column({ name: 'is_default_shipping', type: 'boolean', default: false }) isDefaultShipping: boolean;
  @Column({ name: 'is_default_billing', type: 'boolean', default: false }) isDefaultBilling: boolean;
}
```

**Relationships:** `Profile 1—N Address` (in-schema FK, cascade). Two **partial
unique indexes** guarantee at most one default-shipping and one default-billing
address per profile.

---

## 4. CATALOG module (schema `catalog`) — the dynamic core

Implements the **dynamic-attribute** model (no per-product-type tables) and
**variants**. Categories form a tree; attributes are assigned to categories; a
product's distinguishing attributes drive its variants.

```ts
export enum AttributeType { STRING='STRING', NUMBER='NUMBER', BOOLEAN='BOOLEAN', SELECT='SELECT', MULTISELECT='MULTISELECT' }
export enum ProductStatus { DRAFT='DRAFT', ACTIVE='ACTIVE', ARCHIVED='ARCHIVED' }
export enum MediaType { IMAGE='IMAGE', VIDEO='VIDEO' }

@Entity({ schema: SCHEMA.CATALOG, name: 'category' })
export class Category extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 180 }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'image_url', type: 'text', nullable: true }) imageUrl: string | null;
  @Column({ name: 'parent_id', type: 'uuid', nullable: true }) parentId: string | null;
  @ManyToOne(() => Category, (c) => c.children, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'parent_id' }) parent: Category | null;       // RESTRICT = edge case #4
  @OneToMany(() => Category, (c) => c.parent) children: Category[];
  @Column({ name: 'materialized_path', type: 'text', nullable: true }) path: string | null; // fast subtree queries
  @Column({ type: 'int', default: 0 }) position: number;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}

@Entity({ schema: SCHEMA.CATALOG, name: 'brand' })
export class Brand extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 180 }) slug: string;
  @Column({ name: 'logo_url', type: 'text', nullable: true }) logoUrl: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}

@Entity({ schema: SCHEMA.CATALOG, name: 'attribute' })
export class Attribute extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 100 }) code: string;  // "ram", "color"
  @Column({ type: 'enum', enum: AttributeType }) type: AttributeType;
  @Column({ type: 'varchar', length: 30, nullable: true }) unit: string | null;     // "GB"
  @Column({ name: 'is_variant_defining', type: 'boolean', default: false }) isVariantDefining: boolean; // color/size → variants
  @Column({ name: 'is_filterable', type: 'boolean', default: false }) isFilterable: boolean;
  @OneToMany(() => AttributeOption, (o) => o.attribute) options: AttributeOption[];
}

@Entity({ schema: SCHEMA.CATALOG, name: 'attribute_option' })
@Index(['attributeId', 'value'], { unique: true })
export class AttributeOption extends BaseEntity {              // values for SELECT/MULTISELECT (Red, Blue, S, M)
  @Column({ name: 'attribute_id', type: 'uuid' }) attributeId: string;
  @ManyToOne(() => Attribute, (a) => a.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attribute_id' }) attribute: Attribute;
  @Column({ type: 'varchar', length: 150 }) value: string;
  @Column({ type: 'varchar', length: 150, nullable: true }) label: string | null;
  @Column({ type: 'int', default: 0 }) position: number;
}

// Which attributes apply to a category (the "dynamic attributes per category" rule)
@Entity({ schema: SCHEMA.CATALOG, name: 'category_attribute' })
@Index(['categoryId', 'attributeId'], { unique: true })
export class CategoryAttribute extends BaseEntity {
  @Column({ name: 'category_id', type: 'uuid' }) categoryId: string;
  @ManyToOne(() => Category, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'category_id' }) category: Category;
  @Column({ name: 'attribute_id', type: 'uuid' }) attributeId: string;
  @ManyToOne(() => Attribute, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'attribute_id' }) attribute: Attribute;
  @Column({ name: 'is_required', type: 'boolean', default: false }) isRequired: boolean;
  @Column({ type: 'int', default: 0 }) position: number;
}

@Entity({ schema: SCHEMA.CATALOG, name: 'product' })
@Index(['categoryId']) @Index(['brandId']) @Index(['status'])
export class Product extends AuditableEntity {
  @Column({ type: 'varchar', length: 250 }) name: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 280 }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'category_id', type: 'uuid' }) categoryId: string;
  @ManyToOne(() => Category, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'category_id' }) category: Category;
  @Column({ name: 'brand_id', type: 'uuid', nullable: true }) brandId: string | null;
  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true }) @JoinColumn({ name: 'brand_id' }) brand: Brand | null;
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT }) status: ProductStatus;
  @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, nullable: true })
  basePrice: number | null;                                   // null when fully variant-priced
  @Column({ type: 'char', length: 3, default: 'BDT' }) currency: string;
  @Column({ name: 'rating_avg', type: 'numeric', precision: 3, scale: 2, default: 0 }) ratingAvg: number;  // denormalized from reviews
  @Column({ name: 'rating_count', type: 'int', default: 0 }) ratingCount: number;

  @OneToMany(() => ProductVariant, (v) => v.product) variants: ProductVariant[];
  @OneToMany(() => ProductAttributeValue, (av) => av.product) attributeValues: ProductAttributeValue[];
  @OneToMany(() => ProductMedia, (m) => m.product) media: ProductMedia[];
}

// Non-variant attribute values (e.g. a phone's processor, battery)
@Entity({ schema: SCHEMA.CATALOG, name: 'product_attribute_value' })
@Index(['productId', 'attributeId'], { unique: true })
@Index(['attributeId', 'optionId'])                            // facet filtering
export class ProductAttributeValue extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @ManyToOne(() => Product, (p) => p.attributeValues, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'product_id' }) product: Product;
  @Column({ name: 'attribute_id', type: 'uuid' }) attributeId: string;
  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'attribute_id' }) attribute: Attribute;
  @Column({ name: 'option_id', type: 'uuid', nullable: true }) optionId: string | null; // for SELECT
  @Column({ name: 'value_text', type: 'varchar', length: 255, nullable: true }) valueText: string | null; // for STRING/NUMBER/BOOLEAN
}

@Entity({ schema: SCHEMA.CATALOG, name: 'product_variant' })
export class ProductVariant extends AuditableEntity {
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'product_id' }) product: Product;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 80 }) sku: string;
  @Index('uq_variant_barcode', ['barcode'], { unique: true, where: '"barcode" IS NOT NULL' })
  @Column({ type: 'varchar', length: 80, nullable: true }) barcode: string | null;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) price: number;
  @Column({ name: 'compare_at_price', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, nullable: true })
  compareAtPrice: number | null;
  @Column({ type: 'numeric', precision: 8, scale: 3, nullable: true }) weight: number | null;
  @Column({ name: 'weight_unit', type: 'varchar', length: 5, default: 'kg' }) weightUnit: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  // Stock is OWNED BY the inventory module (inventory.stock_item.variant_id → this.id), no FK here.
  @OneToMany(() => VariantAttributeValue, (av) => av.variant) attributeValues: VariantAttributeValue[];
}

// The variant-defining combination (Red + Small)
@Entity({ schema: SCHEMA.CATALOG, name: 'variant_attribute_value' })
@Index(['variantId', 'attributeId'], { unique: true })
export class VariantAttributeValue extends BaseEntity {
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;
  @ManyToOne(() => ProductVariant, (v) => v.attributeValues, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'variant_id' }) variant: ProductVariant;
  @Column({ name: 'attribute_id', type: 'uuid' }) attributeId: string;
  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'attribute_id' }) attribute: Attribute;
  @Column({ name: 'option_id', type: 'uuid' }) optionId: string;   // variant attrs are always option-based
}

@Entity({ schema: SCHEMA.CATALOG, name: 'product_media' })
@Index(['productId']) @Index(['variantId'])
export class ProductMedia extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @ManyToOne(() => Product, (p) => p.media, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'product_id' }) product: Product;
  @Column({ name: 'variant_id', type: 'uuid', nullable: true }) variantId: string | null; // media specific to a variant
  @Column({ type: 'text' }) url: string;
  @Column({ type: 'enum', enum: MediaType, default: MediaType.IMAGE }) type: MediaType;
  @Column({ type: 'varchar', length: 200, nullable: true }) alt: string | null;
  @Column({ name: 'is_primary', type: 'boolean', default: false }) isPrimary: boolean;
  @Column({ type: 'int', default: 0 }) position: number;
}
```

**Relationships (all in-schema FKs):** `Category` self-tree (`parent_id`,
`RESTRICT` so a category with children/products can't be hard-deleted — edge
case #4 → archive instead); `Category N—N Attribute` via `CategoryAttribute`;
`Attribute 1—N AttributeOption`; `Product N—1 Category`, `Product N—1 Brand`;
`Product 1—N ProductVariant`; `Product 1—N ProductAttributeValue`; `ProductVariant
1—N VariantAttributeValue`; `Product/Variant 1—N ProductMedia`. **Stock is not
here** — `ProductVariant.id` is referenced logically by `inventory.stock_item`
(edge case #5: inventory is variant-level only).

---

## 5. INVENTORY module (schema `inventory`)

Stock per **variant** with an immutable **movement ledger** and a **reservation**
system. `available = quantity_on_hand − quantity_reserved`.

```ts
export enum StockMovementType { IN='IN', OUT='OUT', RESERVE='RESERVE', RELEASE='RELEASE', ADJUST='ADJUST', SALE='SALE', RETURN='RETURN', DAMAGE='DAMAGE' }
export enum ReservationStatus { HELD='HELD', CONFIRMED='CONFIRMED', RELEASED='RELEASED', EXPIRED='EXPIRED' }

@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_item' })
export class StockItem extends AuditableEntity {              // version → safe concurrent decrements
  @Index('uq_stock_variant', ['variantId'], { unique: true })
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;        // → catalog.product_variant.id (logical)
  @Column({ name: 'quantity_on_hand', type: 'int', default: 0 }) quantityOnHand: number;
  @Column({ name: 'quantity_reserved', type: 'int', default: 0 }) quantityReserved: number;
  @Column({ name: 'reorder_level', type: 'int', default: 0 }) reorderLevel: number;  // low-stock threshold
  // available is computed (on_hand - reserved); persist as a generated column if you prefer.
}

@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_movement' })   // APPEND-ONLY ledger (edge case #9)
@Index(['variantId', 'createdAt']) @Index(['referenceType', 'referenceId'])
export class StockMovement extends BaseEntity {                 // no soft delete, never updated
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;
  @Column({ type: 'enum', enum: StockMovementType }) type: StockMovementType;
  @Column({ type: 'int' }) quantity: number;                   // signed delta
  @Column({ name: 'balance_after', type: 'int' }) balanceAfter: number;
  @Column({ name: 'reference_type', type: 'varchar', length: 30, nullable: true }) referenceType: string | null; // 'ORDER','RETURN'
  @Column({ name: 'reference_id', type: 'uuid', nullable: true }) referenceId: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) reason: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
}

@Entity({ schema: SCHEMA.INVENTORY, name: 'stock_reservation' })
@Index(['status', 'expiresAt'])                                 // expiry sweeper job
@Index(['orderId']) @Index(['cartId'])
export class StockReservation extends BaseEntity {
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.HELD }) status: ReservationStatus;
  @Column({ name: 'cart_id', type: 'uuid', nullable: true }) cartId: string | null;
  @Column({ name: 'order_id', type: 'uuid', nullable: true }) orderId: string | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;   // ~15-min hold
}
```

**Relationships:** none cross-schema. `stock_item.variant_id`,
`stock_movement.variant_id`, `stock_reservation.variant_id` are **logical refs**
to `catalog.product_variant.id`. `order_id`/`cart_id` are logical refs to
orders/cart. A BullMQ delayed job releases `HELD` reservations past `expires_at`
(edge cases #1/#3). Every quantity change writes a `stock_movement` row.

---

## 6. CART module (schema `cart`)

Supports **guest carts** (`guest_id`) and logged-in carts, **merge on login**,
and **price snapshots**.

```ts
export enum CartStatus { ACTIVE='ACTIVE', MERGED='MERGED', CONVERTED='CONVERTED', ABANDONED='ABANDONED' }

@Entity({ schema: SCHEMA.CART, name: 'cart' })
@Index('uq_cart_active_user', ['userId'], { unique: true, where: `"status" = 'ACTIVE' AND "user_id" IS NOT NULL` })
@Index('uq_cart_active_guest', ['guestId'], { unique: true, where: `"status" = 'ACTIVE' AND "guest_id" IS NOT NULL` })
@Index(['status', 'lastActivityAt'])                            // abandoned-cart sweeper
export class Cart extends SoftDeletableEntity {
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;   // → auth (logical)
  @Column({ name: 'guest_id', type: 'uuid', nullable: true }) guestId: string | null; // cookie/localStorage
  @Column({ type: 'enum', enum: CartStatus, default: CartStatus.ACTIVE }) status: CartStatus;
  @Column({ type: 'char', length: 3, default: 'BDT' }) currency: string;
  @Column({ name: 'coupon_code', type: 'varchar', length: 50, nullable: true }) couponCode: string | null;
  @Column({ name: 'last_activity_at', type: 'timestamptz', default: () => 'now()' }) lastActivityAt: Date;
  @OneToMany(() => CartItem, (i) => i.cart) items: CartItem[];
}

@Entity({ schema: SCHEMA.CART, name: 'cart_item' })
@Index(['cartId', 'variantId'], { unique: true })              // one line per variant
export class CartItem extends BaseEntity {
  @Column({ name: 'cart_id', type: 'uuid' }) cartId: string;
  @ManyToOne(() => Cart, (c) => c.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'cart_id' }) cart: Cart;
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;   // → catalog (logical)
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;   // → catalog (logical, for display)
  @Column({ type: 'int', default: 1 }) quantity: number;
  @Column({ name: 'unit_price_snapshot', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) unitPriceSnapshot: number;
  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 250 }) productNameSnapshot: string;
}
```

**Relationships:** `Cart 1—N CartItem` (in-schema FK, cascade). `userId`,
`guestId`, `variantId`, `productId` are logical refs. Merge = move the guest
cart's items into the user's `ACTIVE` cart, then mark the guest cart `MERGED`
(edge case #7). Partial-unique indexes guarantee a single active cart per
user/guest.

---

## 7. ORDERS module (schema `orders`)

Order lifecycle with **status history**, **address & price snapshots** (so a
later catalog/address change never rewrites a placed order — edge case #8), and
returns.

```ts
export enum OrderStatus { PENDING='PENDING', CONFIRMED='CONFIRMED', PAID='PAID', PROCESSING='PROCESSING', PACKED='PACKED', SHIPPED='SHIPPED', DELIVERED='DELIVERED', CANCELLED='CANCELLED', RETURN_REQUESTED='RETURN_REQUESTED', RETURNED='RETURNED', REFUNDED='REFUNDED' }
export enum PaymentStatus { UNPAID='UNPAID', PAID='PAID', PARTIALLY_REFUNDED='PARTIALLY_REFUNDED', REFUNDED='REFUNDED' }
export enum OrderAddressType { SHIPPING='SHIPPING', BILLING='BILLING' }
export enum ReturnStatus { REQUESTED='REQUESTED', APPROVED='APPROVED', REJECTED='REJECTED', RECEIVED='RECEIVED', REFUNDED='REFUNDED' }

@Entity({ schema: SCHEMA.ORDERS, name: 'order' })
@Index(['userId']) @Index(['status']) @Index(['paymentStatus'])
export class Order extends AuditableEntity {
  @Index({ unique: true }) @Column({ name: 'order_number', type: 'varchar', length: 30 }) orderNumber: string; // human-readable
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;   // null = guest checkout
  @Column({ name: 'guest_email', type: 'varchar', length: 320, nullable: true }) guestEmail: string | null;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING }) status: OrderStatus;
  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID }) paymentStatus: PaymentStatus;
  @Column({ type: 'char', length: 3, default: 'BDT' }) currency: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) subtotal: number;
  @Column({ name: 'discount_total', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, default: 0 }) discountTotal: number;
  @Column({ name: 'shipping_total', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, default: 0 }) shippingTotal: number;
  @Column({ name: 'tax_total', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, default: 0 }) taxTotal: number;
  @Column({ name: 'grand_total', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) grandTotal: number;
  @Column({ name: 'coupon_code', type: 'varchar', length: 50, nullable: true }) couponCode: string | null;
  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true }) placedAt: Date | null;

  @OneToMany(() => OrderItem, (i) => i.order) items: OrderItem[];
  @OneToMany(() => OrderAddress, (a) => a.order) addresses: OrderAddress[];
  @OneToMany(() => OrderStatusHistory, (h) => h.order) statusHistory: OrderStatusHistory[];
}

@Entity({ schema: SCHEMA.ORDERS, name: 'order_item' })
@Index(['orderId']) @Index(['variantId'])
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;        // → catalog (logical)
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'sku_snapshot', type: 'varchar', length: 80 }) skuSnapshot: string;
  @Column({ name: 'product_name_snapshot', type: 'varchar', length: 250 }) productNameSnapshot: string;
  @Column({ name: 'variant_label_snapshot', type: 'varchar', length: 250, nullable: true }) variantLabelSnapshot: string | null;
  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) unitPrice: number; // LOCKED at checkout
  @Column({ type: 'int' }) quantity: number;
  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) lineTotal: number;
}

@Entity({ schema: SCHEMA.ORDERS, name: 'order_address' })       // immutable snapshot, NOT an FK to users.address
export class OrderAddress extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => Order, (o) => o.addresses, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ type: 'enum', enum: OrderAddressType }) type: OrderAddressType;
  @Column({ name: 'recipient_name', type: 'varchar', length: 150 }) recipientName: string;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ name: 'line1', type: 'varchar', length: 255 }) line1: string;
  @Column({ name: 'line2', type: 'varchar', length: 255, nullable: true }) line2: string | null;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) state: string | null;
  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true }) postalCode: string | null;
  @Column({ type: 'char', length: 2, default: 'BD' }) country: string;
}

@Entity({ schema: SCHEMA.ORDERS, name: 'order_status_history' }) // APPEND-ONLY
@Index(['orderId', 'createdAt'])
export class OrderStatusHistory extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => Order, (o) => o.statusHistory, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ name: 'from_status', type: 'enum', enum: OrderStatus, nullable: true }) fromStatus: OrderStatus | null;
  @Column({ name: 'to_status', type: 'enum', enum: OrderStatus }) toStatus: OrderStatus;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ name: 'changed_by', type: 'uuid', nullable: true }) changedBy: string | null;
}

@Entity({ schema: SCHEMA.ORDERS, name: 'order_return' })
@Index(['orderId']) @Index(['status'])
export class OrderReturn extends SoftDeletableEntity {
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @ManyToOne(() => Order, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'order_id' }) order: Order;
  @Column({ type: 'enum', enum: ReturnStatus, default: ReturnStatus.REQUESTED }) status: ReturnStatus;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ name: 'requested_by', type: 'uuid', nullable: true }) requestedBy: string | null;
  @OneToMany(() => OrderReturnItem, (i) => i.return) items: OrderReturnItem[];
}

@Entity({ schema: SCHEMA.ORDERS, name: 'order_return_item' })
export class OrderReturnItem extends BaseEntity {
  @Column({ name: 'return_id', type: 'uuid' }) returnId: string;
  @ManyToOne(() => OrderReturn, (r) => r.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'return_id' }) return: OrderReturn;
  @Column({ name: 'order_item_id', type: 'uuid' }) orderItemId: string;
  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'order_item_id' }) orderItem: OrderItem;
  @Column({ type: 'int' }) quantity: number;
}
```

**Relationships:** `Order 1—N OrderItem | OrderAddress | OrderStatusHistory |
OrderReturn` (in-schema FKs); `OrderReturn 1—N OrderReturnItem → OrderItem`.
`userId`, `variantId`, `productId` are logical refs. Snapshots (price, sku,
name, address) make orders immutable historical records.

---

## 8. PAYMENTS module (schema `payments`)

Gateway-agnostic payment with an **append-only transaction log** and
**idempotent webhooks** (edge case #2).

```ts
export enum PaymentGateway { BKASH='BKASH', NAGAD='NAGAD', ROCKET='ROCKET', SSLCOMMERZ='SSLCOMMERZ', SHURJOPAY='SHURJOPAY', COD='COD' }
export enum PaymentState { INITIATED='INITIATED', PENDING='PENDING', SUCCESS='SUCCESS', FAILED='FAILED', CANCELLED='CANCELLED', REFUNDED='REFUNDED' }
export enum PaymentTxnType { CHARGE='CHARGE', CALLBACK='CALLBACK', WEBHOOK='WEBHOOK', REFUND='REFUND' }

@Entity({ schema: SCHEMA.PAYMENTS, name: 'payment' })
@Index(['orderId']) @Index(['status'])
export class Payment extends AuditableEntity {
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;          // → orders (logical)
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'enum', enum: PaymentGateway }) gateway: PaymentGateway;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) amount: number;
  @Column({ type: 'char', length: 3, default: 'BDT' }) currency: string;
  @Column({ type: 'enum', enum: PaymentState, default: PaymentState.INITIATED }) status: PaymentState;
  @Index({ unique: true }) @Column({ name: 'idempotency_key', type: 'varchar', length: 100 }) idempotencyKey: string;
  @Column({ name: 'gateway_reference', type: 'varchar', length: 150, nullable: true }) gatewayReference: string | null;
  @OneToMany(() => PaymentTransaction, (t) => t.payment) transactions: PaymentTransaction[];
}

@Entity({ schema: SCHEMA.PAYMENTS, name: 'payment_transaction' })  // APPEND-ONLY
export class PaymentTransaction extends BaseEntity {
  @Column({ name: 'payment_id', type: 'uuid' }) paymentId: string;
  @ManyToOne(() => Payment, (p) => p.transactions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'payment_id' }) payment: Payment;
  @Column({ type: 'enum', enum: PaymentTxnType }) type: PaymentTxnType;
  @Column({ type: 'enum', enum: PaymentState }) status: PaymentState;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) amount: number;
  @Index('uq_txn_gateway_id', ['gatewayTxnId'], { unique: true, where: '"gateway_txn_id" IS NOT NULL' })
  @Column({ name: 'gateway_txn_id', type: 'varchar', length: 150, nullable: true }) gatewayTxnId: string | null; // dedupes webhooks
  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true }) rawPayload: Record<string, unknown> | null;
}

@Entity({ schema: SCHEMA.PAYMENTS, name: 'refund' })
@Index(['orderId']) @Index(['status'])
export class Refund extends SoftDeletableEntity {
  @Column({ name: 'payment_id', type: 'uuid' }) paymentId: string;
  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'payment_id' }) payment: Payment;
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) amount: number;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ type: 'enum', enum: PaymentState, default: PaymentState.PENDING }) status: PaymentState;
  @Column({ name: 'gateway_refund_id', type: 'varchar', length: 150, nullable: true }) gatewayRefundId: string | null;
}
```

**Relationships:** `Payment 1—N PaymentTransaction`, `Payment 1—N Refund`
(in-schema FKs). `orderId`/`userId` logical refs. The unique `idempotency_key`
(initiation) and unique `gateway_txn_id` (webhooks) make retries safe; a
reconciliation job uses these to recover dropped callbacks (edge case #2).

---

## 9. PROMOTIONS module (schema `promotions`)

Campaign container + **coupon engine** (with abuse controls — edge case #6) +
**flash sales** (auto-activated by schedule).

```ts
export enum CouponType { PERCENTAGE='PERCENTAGE', FIXED='FIXED', FREE_SHIPPING='FREE_SHIPPING' }
export enum FlashSaleStatus { SCHEDULED='SCHEDULED', ACTIVE='ACTIVE', ENDED='ENDED' }

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'promotion' })       // = "Promotion" / campaign container
@Index(['isActive', 'startsAt', 'endsAt'])
export class Promotion extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true }) startsAt: Date | null;
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon' })
@Index(['isActive', 'startsAt', 'endsAt'])
export class Coupon extends SoftDeletableEntity {
  @Index({ unique: true }) @Column({ type: 'varchar', length: 50 }) code: string;
  @Column({ name: 'promotion_id', type: 'uuid', nullable: true }) promotionId: string | null;
  @ManyToOne(() => Promotion, { onDelete: 'SET NULL', nullable: true }) @JoinColumn({ name: 'promotion_id' }) promotion: Promotion | null;
  @Column({ type: 'enum', enum: CouponType }) type: CouponType;
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) value: number;
  @Column({ name: 'min_purchase_amount', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, nullable: true }) minPurchaseAmount: number | null;
  @Column({ name: 'max_discount_amount', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer, nullable: true }) maxDiscountAmount: number | null; // cap on %
  @Column({ name: 'usage_limit', type: 'int', nullable: true }) usageLimit: number | null;            // global
  @Column({ name: 'usage_limit_per_user', type: 'int', nullable: true }) usageLimitPerUser: number | null;
  @Column({ name: 'used_count', type: 'int', default: 0 }) usedCount: number;
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true }) startsAt: Date | null;
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @OneToMany(() => CouponCategory, (c) => c.coupon) categories: CouponCategory[];
}

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon_category' }) // coupon limited to specific categories
@Index(['couponId', 'categoryId'], { unique: true })
export class CouponCategory extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' }) couponId: string;
  @ManyToOne(() => Coupon, (c) => c.categories, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'coupon_id' }) coupon: Coupon;
  @Column({ name: 'category_id', type: 'uuid' }) categoryId: string;   // → catalog (logical)
}

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'coupon_redemption' }) // APPEND-ONLY — enforces limits + abuse monitoring
@Index(['couponId', 'userId']) @Index(['couponId', 'orderId'], { unique: true })
export class CouponRedemption extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' }) couponId: string;
  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'coupon_id' }) coupon: Coupon;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;   // → auth (logical)
  @Column({ name: 'order_id', type: 'uuid' }) orderId: string;                          // → orders (logical)
  @Column({ name: 'discount_amount', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) discountAmount: number;
  @Column({ name: 'ip_address', type: 'inet', nullable: true }) ipAddress: string | null; // abuse monitoring
}

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'flash_sale' })
@Index(['status', 'startsAt', 'endsAt'])
export class FlashSale extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt: Date;
  @Column({ type: 'enum', enum: FlashSaleStatus, default: FlashSaleStatus.SCHEDULED }) status: FlashSaleStatus;
  @OneToMany(() => FlashSaleItem, (i) => i.flashSale) items: FlashSaleItem[];
}

@Entity({ schema: SCHEMA.PROMOTIONS, name: 'flash_sale_item' })
@Index(['flashSaleId', 'variantId'], { unique: true })
export class FlashSaleItem extends BaseEntity {
  @Column({ name: 'flash_sale_id', type: 'uuid' }) flashSaleId: string;
  @ManyToOne(() => FlashSale, (f) => f.items, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'flash_sale_id' }) flashSale: FlashSale;
  @Column({ name: 'variant_id', type: 'uuid' }) variantId: string;     // → catalog (logical)
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'sale_price', type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer }) salePrice: number;
  @Column({ name: 'quantity_limit', type: 'int', nullable: true }) quantityLimit: number | null;
  @Column({ name: 'sold_count', type: 'int', default: 0 }) soldCount: number;
}
```

**Relationships:** `Promotion 1—N Coupon` (optional); `Coupon 1—N CouponCategory
| CouponRedemption`; `FlashSale 1—N FlashSaleItem` (in-schema FKs). The unique
`(coupon_id, order_id)` redemption index + `used_count`/`usage_limit_per_user`
counters + `ip_address` logging enforce coupon abuse limits (edge case #6).
`category_id`, `variant_id`, `user_id`, `order_id` are logical refs.

---

## 10. CMS module (schema `cms`)

Homepage builder + banners (hero slides are banners with a `HERO` placement —
no duplicate table) + popups + landing pages.

```ts
export enum HomepageSectionType { HERO_SLIDER='HERO_SLIDER', FLASH_SALE='FLASH_SALE', CATEGORY_GRID='CATEGORY_GRID', FEATURED_PRODUCTS='FEATURED_PRODUCTS', BRANDS='BRANDS', BANNER='BANNER', BEST_SELLERS='BEST_SELLERS', NEWSLETTER='NEWSLETTER' }
export enum BannerPlacement { HOME_HERO='HOME_HERO', HOME_STRIP='HOME_STRIP', CATEGORY='CATEGORY', ANNOUNCEMENT='ANNOUNCEMENT' }
export enum PopupTrigger { ON_LOAD='ON_LOAD', AFTER_DELAY='AFTER_DELAY', EXIT_INTENT='EXIT_INTENT', ON_SCROLL='ON_SCROLL' }
export enum PopupFrequency { ONCE='ONCE', EVERY_SESSION='EVERY_SESSION', ALWAYS='ALWAYS' }
export enum AudienceTarget { GUESTS='GUESTS', LOGGED_IN='LOGGED_IN', EVERYONE='EVERYONE' }

@Entity({ schema: SCHEMA.CMS, name: 'homepage_section' })
@Index(['isActive', 'position'])
export class HomepageSection extends SoftDeletableEntity {
  @Column({ type: 'enum', enum: HomepageSectionType }) type: HomepageSectionType;
  @Column({ type: 'varchar', length: 150, nullable: true }) title: string | null;
  @Column({ type: 'int', default: 0 }) position: number;             // drag-to-reorder, no deploy
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'jsonb', default: {} }) config: Record<string, unknown>; // section-specific (e.g. category ids, product ids)
}

@Entity({ schema: SCHEMA.CMS, name: 'cms_banner' })                // CMSBanner (+ hero slides via placement)
@Index(['placement', 'isActive', 'position'])
export class CmsBanner extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150, nullable: true }) title: string | null;
  @Column({ name: 'image_url', type: 'text' }) imageUrl: string;
  @Column({ name: 'mobile_image_url', type: 'text', nullable: true }) mobileImageUrl: string | null;
  @Column({ name: 'cta_text', type: 'varchar', length: 80, nullable: true }) ctaText: string | null;
  @Column({ name: 'cta_url', type: 'text', nullable: true }) ctaUrl: string | null;
  @Column({ type: 'enum', enum: BannerPlacement }) placement: BannerPlacement;
  @Column({ type: 'int', default: 0 }) position: number;
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true }) startsAt: Date | null;
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}

@Entity({ schema: SCHEMA.CMS, name: 'cms_popup' })                 // CMSPopup
@Index(['isActive', 'startsAt', 'endsAt'])
export class CmsPopup extends SoftDeletableEntity {
  @Column({ type: 'varchar', length: 150 }) title: string;
  @Column({ type: 'text', nullable: true }) content: string | null;
  @Column({ name: 'image_url', type: 'text', nullable: true }) imageUrl: string | null;
  @Column({ name: 'cta_text', type: 'varchar', length: 80, nullable: true }) ctaText: string | null;
  @Column({ name: 'cta_url', type: 'text', nullable: true }) ctaUrl: string | null;
  @Column({ type: 'enum', enum: PopupTrigger, default: PopupTrigger.ON_LOAD }) trigger: PopupTrigger;
  @Column({ name: 'delay_seconds', type: 'int', default: 0 }) delaySeconds: number;
  @Column({ type: 'enum', enum: PopupFrequency, default: PopupFrequency.ONCE }) frequency: PopupFrequency;
  @Column({ type: 'enum', enum: AudienceTarget, default: AudienceTarget.EVERYONE }) audience: AudienceTarget;
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true }) startsAt: Date | null;
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true }) endsAt: Date | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
}

@Entity({ schema: SCHEMA.CMS, name: 'landing_page' })
export class LandingPage extends SoftDeletableEntity {
  @Index({ unique: true }) @Column({ type: 'varchar', length: 180 }) slug: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'jsonb', default: {} }) content: Record<string, unknown>;   // structured blocks
  @Column({ name: 'seo_title', type: 'varchar', length: 200, nullable: true }) seoTitle: string | null;
  @Column({ name: 'seo_description', type: 'varchar', length: 300, nullable: true }) seoDescription: string | null;
  @Column({ name: 'is_published', type: 'boolean', default: false }) isPublished: boolean;
}
```

**Relationships:** CMS entities are largely standalone (config-driven). Their
`config`/`content` JSONB and logical id arrays reference catalog
products/categories without FKs (CMS must never block on catalog deletes).

---

## 11. REVIEWS module (schema `reviews`)

Product ratings/reviews with **verified-purchase** detection and **moderation**.
Aggregates are denormalized onto `catalog.product` (`rating_avg`, `rating_count`)
and refreshed on approval via an outbox event.

```ts
export enum ReviewStatus { PENDING='PENDING', APPROVED='APPROVED', REJECTED='REJECTED' }

@Entity({ schema: SCHEMA.REVIEWS, name: 'review' })
@Index('uq_review_user_product', ['userId', 'productId'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['productId', 'status'])                                  // public listing
export class Review extends SoftDeletableEntity {
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;     // → catalog (logical)
  @Column({ name: 'variant_id', type: 'uuid', nullable: true }) variantId: string | null;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;           // → auth (logical)
  @Column({ name: 'order_id', type: 'uuid', nullable: true }) orderId: string | null; // verified-purchase link
  @Column({ type: 'smallint' }) rating: number;                        // 1..5 (CHECK constraint)
  @Column({ type: 'varchar', length: 200, nullable: true }) title: string | null;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ name: 'is_verified_purchase', type: 'boolean', default: false }) isVerifiedPurchase: boolean;
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING }) status: ReviewStatus;
  @Column({ name: 'helpful_count', type: 'int', default: 0 }) helpfulCount: number;
}
```

**Relationships:** standalone; `productId`, `userId`, `orderId` are logical refs.
A partial-unique `(user_id, product_id)` index enforces one review per product
per user. `rating` carries a `CHECK (rating BETWEEN 1 AND 5)` (added in the
migration).

---

## 12. Cross-module reference map (logical UUID links — NO cross-schema FK)

```
auth.account.id ──(logical user_id)──▶ users.profile.user_id
                                       cart.cart.user_id
                                       orders.order.user_id
                                       payments.payment.user_id
                                       reviews.review.user_id
                                       promotions.coupon_redemption.user_id

catalog.product_variant.id ─────────▶ inventory.stock_item.variant_id
                                       inventory.stock_movement.variant_id
                                       inventory.stock_reservation.variant_id
                                       cart.cart_item.variant_id
                                       orders.order_item.variant_id
                                       promotions.flash_sale_item.variant_id
                                       reviews.review.variant_id

catalog.product.id   ───────────────▶ cart/order item product_id, reviews, flash_sale_item
catalog.category.id  ───────────────▶ promotions.coupon_category.category_id

orders.order.id  ────────────────────▶ payments.payment.order_id
                                       promotions.coupon_redemption.order_id
                                       inventory.stock_reservation.order_id

cart.cart.id     ────────────────────▶ inventory.stock_reservation.cart_id
```

Each arrow is a **plain indexed `uuid` column** resolved through the owning
module's **service** (e.g. orders calls `CatalogService`/`InventoryService`),
never a JOIN across schemas. That is the seam that lets any module be extracted
into its own service later with `pg_dump -n <schema>`.

---

## 13. Indexing strategy (summary)

| Kind | Examples |
| --- | --- |
| **Unique business keys** | `account.email` (partial, active-only), `profile.user_id`, `category/brand/product/landing_page.slug`, `product_variant.sku`, `order.order_number`, `coupon.code`, `payment.idempotency_key`, `payment_transaction.gateway_txn_id` (partial), `stock_item.variant_id` |
| **Logical-ref lookups** | every cross-module `*_id` column (`user_id`, `variant_id`, `product_id`, `order_id`, `cart_id`) |
| **Hot filters** | `product(status)`, `order(status, payment_status)`, `payment(status)`, `*.is_active`, `cms_banner(placement, is_active, position)` |
| **Job sweepers** | `stock_reservation(status, expires_at)`, `cart(status, last_activity_at)`, `flash_sale/coupon(status/is_active, starts_at, ends_at)` |
| **Partial-unique (soft-delete & defaults)** | active email/phone, one active cart per user/guest, one default shipping/billing address, one review per user+product |
| **Composite/append-only** | `stock_movement(variant_id, created_at)`, `order_status_history(order_id, created_at)` |
| **Facets (search prep)** | `product_attribute_value(attribute_id, option_id)` |

---

## 14. Edge cases → schema features

| # | Edge case | Schema feature |
| --- | --- | --- |
| 1 | Stock zero during checkout | `stock_item` + revalidation before payment |
| 2 | Payment ok, callback fails | `payment.idempotency_key` + `payment_transaction.gateway_txn_id` unique → reconciliation |
| 3 | Multi-tab checkout | `stock_reservation` (HELD + expires_at) |
| 4 | Delete category with products | `category.parent_id` & `product.category_id` `ON DELETE RESTRICT` → archive (`is_active`) |
| 5 | Variant stock mismatch | inventory keyed by `variant_id` only |
| 6 | Coupon abuse | `coupon_redemption` unique `(coupon, order)`, per-user counts, `ip_address` |
| 7 | Guest cart + login | `cart.guest_id` / `user_id` + `CartStatus.MERGED` |
| 8 | Flash sale ends mid-checkout | price/label **snapshots** on `cart_item` & `order_item` |
| 9 | Refund after stock adjusted | append-only `stock_movement` ledger (RETURN/ADJUST rows) |

---

## 15. Deferred (out of this request's 10 modules)

- **notifications**, **reporting**, **audit** schemas (in `PROJECT_PLAN.md`
  Phases 10–11). Audit is cross-cutting (`audit_log`).
- **Refresh tokens** intentionally live in **Redis** (Phase 0 `RefreshTokenStore`),
  not a table.
- **outbox_event** table (one per module that emits events) — infra for
  cross-module eventual consistency; add with the outbox relay in Phase 0.
- **Search** (Elasticsearch/OpenSearch) projections — Phase 12; the
  `product_attribute_value(attribute_id, option_id)` index supports facets until then.

> **Build order (matches PROJECT_PLAN phases):** extensions/enums → auth → users
> → catalog → inventory → cart → orders → payments → promotions → cms → reviews,
> each as its own migration (`synchronize` stays off).
```
