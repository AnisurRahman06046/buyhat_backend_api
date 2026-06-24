# Phase 1 — Auth, Users, Roles & Addresses (design)

> Detailed plan, API design, and edge-case scenarios for Phase 1. Read with
> `PROJECT_PLAN.md` (roadmap) and `DATABASE_SCHEMA.md` (entities). Builds on the
> completed Phase 0 foundation (schema-per-module, `AuditableEntity`,
> `BaseRepository`/`BaseService`, refresh-token rotation, throttling, single
> exception filter).
>
> **Date:** 2026-06-24 · **Status:** design — awaiting go-ahead.

---

## 1. Scope

**In scope**
- **auth** module: registration, login, refresh (built), logout (built),
  email verification, password reset, optional OTP login; identity, credentials,
  account status, RBAC roles.
- **users** module: profile (`/users/me`), addresses CRUD, preferences.
- **RBAC**: 5 roles, JWT carries `roles[]`, `RolesGuard` enforces.
- **Outbox relay** (first use): `user.registered` → users creates profile
  (eventual consistency).
- **Notifications stub**: a logging email/SMS provider so verify/reset/OTP have a
  sink; the real multi-channel module is Phase 10.

**Out of scope (later)**: social login, TOTP 2FA, full notifications, admin
console UI, cart-merge on login (Phase 4).

### The key refactor — split the combined `User`
Phase 0 left a single `users.users` entity (email + password + role + names).
Phase 1 **splits it along the module boundary**:

| Today (combined `User`) | Phase 1 |
| --- | --- |
| email, password_hash, role, is_active, email_verified_at | → **`auth.account`** (+ `account_role`, `status`) |
| first_name, last_name | → **`users.profile`** (+ phone, locale, currency, preferences) |

`account.id` becomes the **global user id** (JWT `sub`). No table migration for
the old combined entity was ever applied, so there is nothing to drop — it is a
clean code refactor.

---

## 2. Data model (Phase 1 slice of `DATABASE_SCHEMA.md`)

**schema `auth`**
- `account` — id, email (citext, partial-unique active), password_hash (nullable),
  status (`AccountStatus`), email_verified_at, last_login_at, +Auditable.
- `account_role` — (account_id, role) unique; **M:N** so a user can be e.g.
  ADMIN + INVENTORY_MANAGER. JWT carries the array.
- `one_time_token` — account_id, purpose (EMAIL_VERIFICATION | PASSWORD_RESET |
  OTP_LOGIN), token_hash (never raw), expires_at, consumed_at.
- `outbox_event` — aggregate_type, aggregate_id, event_type, payload jsonb,
  status (PENDING|PUBLISHED|FAILED), attempts, published_at.

**schema `users`**
- `profile` — user_id (unique, = account.id logical), first/last/display name,
  phone (E.164, partial-unique), locale, currency (BDT), marketing_opt_in,
  preferences jsonb, +Auditable.
- `address` — profile_id (in-schema FK), recipient, phone, line1/2, city, state,
  postal_code, country, is_default_shipping, is_default_billing; two partial-
  unique indexes (one default each).

**Migrations (ordered, after Phase 0's two):**
1. `AddCitextExtension` — `CREATE EXTENSION IF NOT EXISTS citext` (case-insensitive email).
2. `CreateAuthTables` — account, account_role, one_time_token, outbox_event.
3. `CreateUsersTables` — profile, address.

---

## 3. RBAC design

- `Role` = `CUSTOMER` (default) | `ADMIN` | `INVENTORY_MANAGER` |
  `CUSTOMER_SUPPORT` | `MARKETING_MANAGER`.
- **JWT payload changes** from `role: Role` → `roles: Role[]`. Affected:
  `JwtPayload`, `TokenService.issueTokens(...)`, `JwtStrategy.validate`,
  `AuthenticatedUser`, `RolesGuard`, `@CurrentUser`.
- **`RolesGuard` semantics**: a route's `@Roles(A, B)` passes if the user holds
  **any** of the listed roles (OR). No `@Roles` ⇒ any authenticated user.
- First `ADMIN` is created by the Phase 0 seed; roles are otherwise assigned by an
  admin via `PATCH /users/:id/roles`.

### Account status state machine
```
PENDING_VERIFICATION ──verify email──▶ ACTIVE
        │                                 │
        └──────────── login allowed ──────┘     (email-gated features still locked)
ACTIVE ──admin suspend──▶ SUSPENDED ──admin reinstate──▶ ACTIVE
ACTIVE ──user/admin──▶ DEACTIVATED  (login blocked)
```
- **Login allowed** for `PENDING_VERIFICATION` and `ACTIVE`; **blocked** for
  `SUSPENDED` / `DEACTIVATED` (401).
- Email-verification-gated actions (e.g. checkout in later phases) require
  `email_verified_at IS NOT NULL`.

---

## 4. Auth flows

### 4.1 Registration (outbox → eventual profile)
```
POST /auth/register
  └─ single auth TX:
       INSERT account (status=PENDING_VERIFICATION)
       INSERT account_role (CUSTOMER)
       INSERT one_time_token (EMAIL_VERIFICATION)
       INSERT outbox_event ('user.registered', {userId,email,firstName,lastName})
  └─ return token pair  (account usable immediately)
Outbox relay → BullMQ 'domain-events' → users consumer:
       INSERT profile (idempotent on unique user_id)
Notifications stub → send verification email
```
Atomicity via the **transactional outbox** (no dual-write): the event is
committed in the same TX as the account, then relayed asynchronously.

### 4.2 Login
- Fetch account incl. `password_hash` (select:false → explicit add).
- **Always run a hash compare** — against a constant dummy hash when the account
  is missing — to avoid user-enumeration via timing.
- Reject `SUSPENDED`/`DEACTIVATED`. Update `last_login_at`. Issue tokens.

### 4.3 Email verification
`POST /auth/verify-email { token }` → look up `one_time_token` by hash, check
purpose + unexpired + unconsumed → set `account.email_verified_at = now()`,
mark token consumed. `POST /auth/resend-verification` re-issues (throttled).

### 4.4 Password reset
- `POST /auth/forgot-password { email }` → **always 200** (no enumeration);
  if the account exists, issue a `PASSWORD_RESET` token + email it.
- `POST /auth/reset-password { token, newPassword }` → validate token → update
  hash → **consume token** → **revoke all refresh tokens** (`revokeAll`) so every
  session is logged out.

### 4.5 Refresh & logout (already built in Phase 0)
Rotation + reuse-detection (`RefreshTokenStore`); logout revokes the session.

### 4.6 OTP login (optional — confirm)
`POST /auth/otp/request { phone|email }` issues a short-lived `OTP_LOGIN` token
(6-digit, hashed); `POST /auth/otp/verify { identifier, code }` exchanges it for
tokens. Throttled + attempt-limited.

---

## 5. API design

> All responses use the Phase 0 envelope (`{ success, data, meta }`). Shapes
> below describe the `data` payload. Public = no auth. 🔒 = requires access token.
> Strict throttle = 5/60s (already applied to register/login/refresh/logout).

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Body | 200/201 data | Errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/register` | public, strict | `{ email, password, firstName?, lastName? }` | `{ accessToken, refreshToken, tokenType }` | 409 email taken, 400 weak pw |
| POST | `/login` | public, strict | `{ email, password }` | token pair | 401 invalid / suspended |
| POST | `/refresh` | public, strict | `{ refreshToken }` | token pair | 401 invalid / reuse |
| POST | `/logout` | public, strict | `{ refreshToken }` | `{ revoked: true }` | — |
| POST | `/verify-email` | public | `{ token }` | `{ verified: true }` | 400 expired/used |
| POST | `/resend-verification` | 🔒, strict | — | `{ sent: true }` | 409 already verified |
| POST | `/forgot-password` | public, strict | `{ email }` | `{ sent: true }` *(always)* | — |
| POST | `/reset-password` | public, strict | `{ token, newPassword }` | `{ reset: true }` | 400 expired/used |
| POST | `/otp/request` | public, strict | `{ identifier }` | `{ sent: true }` | — |
| POST | `/otp/verify` | public, strict | `{ identifier, code }` | token pair | 401 invalid/expired |
| GET | `/me` | 🔒 | — | `{ id, email, roles, emailVerified }` | 401 |

### Users — self (`/api/v1/users/me`)

| Method | Path | Auth | Body | data |
| --- | --- | --- | --- | --- |
| GET | `/users/me` | 🔒 | — | full profile (composed: identity from auth + profile fields) |
| PATCH | `/users/me` | 🔒 | `{ firstName?, lastName?, displayName?, phone?, locale?, currency?, marketingOptIn?, preferences? }` | updated profile |
| GET | `/users/me/addresses` | 🔒 | — | `Address[]` |
| POST | `/users/me/addresses` | 🔒 | address fields | created `Address` |
| PATCH | `/users/me/addresses/:id` | 🔒 | partial address | updated `Address` |
| DELETE | `/users/me/addresses/:id` | 🔒 | — | `204` |
| PUT | `/users/me/addresses/:id/default` | 🔒 | `{ shipping?: bool, billing?: bool }` | updated `Address` |

### Users — admin (`/api/v1/users`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | 🔒 ADMIN | paginated list (filter by role/status) |
| GET | `/users/:id` | 🔒 ADMIN, CUSTOMER_SUPPORT | view one |
| PATCH | `/users/:id/status` | 🔒 ADMIN | `{ status }` suspend / reactivate / deactivate |
| PATCH | `/users/:id/roles` | 🔒 ADMIN | `{ roles: Role[] }` assign roles |

**Password rule** (DTO): min 8 chars, at least one letter + one number (tune as
needed). **Mass-assignment safe**: the global `ValidationPipe` whitelist + the
fact that `role`/`status` are *not* fields on self-update DTOs means a customer
can never elevate themselves; only admin endpoints touch role/status.

---

## 6. Security requirements

- **Password hashing — D3:** switch from bcrypt → **Argon2id** (spec asks for
  Argon2; stronger memory-hard KDF). Adds the `argon2` dependency; isolate behind
  a `PasswordHasher` so it's swappable.
- **One-time tokens**: random 32-byte secret, stored **hashed** (SHA-256), single
  use (`consumed_at`), short TTL (verify 24h, reset 1h, OTP 5m).
- **JWT**: access 15m / refresh 7d (config); secrets ≥32 chars (Phase 0).
- **Throttling**: strict 5/60s on all credential endpoints (Phase 0 pattern).
- **No enumeration**: forgot-password & login give generic responses; login uses
  constant-time dummy-hash compare.
- **Audit**: log `auth.login`, `auth.password_reset`, `account.status_changed`,
  `account.roles_changed` (audit interceptor introduced here; full audit module Phase 11).

---

## 7. Edge-case scenarios

| # | Scenario | Handling |
| --- | --- | --- |
| E1 | **Duplicate email** (incl. concurrent race) | citext partial-unique index + Postgres `23505 → 409` (Phase 0). No pre-check TOCTOU. |
| E2 | **Register OK but profile creation fails/lags** | Outbox + idempotent consumer (unique `user_id`); `GET /users/me` composes identity from auth and tolerates a not-yet-created profile (lazy-create or empty profile). Account usable from token meanwhile. |
| E3 | **Relay delivers `user.registered` twice** | Consumer upsert on unique `user_id` → second is a no-op. |
| E4 | **Login, unverified email** | Allowed (status PENDING_VERIFICATION); email-gated features stay locked until verified. |
| E5 | **Login, suspended/deactivated** | 401 `Invalid credentials` (don't reveal status to anonymous). |
| E6 | **User enumeration via timing** | Always compare against a dummy Argon2 hash when account missing. |
| E7 | **Refresh-token replay / reuse** | jti rotation; unknown jti ⇒ revoke whole family (Phase 0). |
| E8 | **Refresh after logout** | jti consumed/revoked ⇒ 401 (Phase 0). |
| E9 | **Password-reset token reused / expired** | `consumed_at` + `expires_at` checked; single-use. |
| E10 | **Multiple forgot-password requests** | Latest token valid; older ones still single-use until expiry (or invalidate prior PASSWORD_RESET tokens on new request). |
| E11 | **Password reset succeeds** | Revoke ALL refresh tokens (`revokeAll`) → every device logged out. |
| E12 | **Email-verification token: expired / wrong account / already verified** | 400 with specific code; `resend-verification` is 409 if already verified. |
| E13 | **Email change** (future PATCH) | New email must be unique; re-enter PENDING_VERIFICATION + re-verify; old soft-deleted emails don't block (partial-unique active-only). |
| E14 | **Concurrent profile update** | `version` optimistic lock on profile/account → stale write rejected (409). |
| E15 | **Address ownership** | Every `/users/me/addresses/:id` op is scoped to the caller's profile; another user's id → 404 (not 403, to avoid leaking existence). |
| E16 | **One default shipping/billing** | Two partial-unique indexes; setting a new default clears the old in one TX. |
| E17 | **Deleting the default address** | Allowed (soft delete); default flag simply unset — no dangling default. |
| E18 | **Privilege escalation via body** | `role`/`status` absent from self DTOs + whitelist pipe; only admin routes mutate them. |
| E19 | **Stale roles in access token** | Access token keeps old `roles[]` until expiry (≤15m); refresh re-reads roles. Admin role/status change ⇒ optionally `revokeAll` to force immediate refresh. |
| E20 | **Immediate suspension vs stateless JWT** | Suspending revokes refresh tokens (dies within ≤15m). For instant cutoff, `JwtStrategy.validate` can check a Redis "revoked" set / account status (trade-off: a lookup per request). **Decision D6.** |
| E21 | **OTP brute force** | 6-digit hashed, 5-min TTL, max N attempts then invalidate; endpoint throttled. |
| E22 | **Self-deactivation then login** | DEACTIVATED blocks login; reactivation is admin-only (or a re-activation flow). |
| E23 | **Admin removes own ADMIN role / suspends self** | Guard against locking out the last admin: refuse to remove the final ADMIN / self-suspend the last admin. |

---

## 8. Build order (tasks)

1. `argon2` dep + `PasswordHasher` port (replace bcrypt usage).
2. JWT `roles[]` refactor: `JwtPayload`, `TokenService`, `JwtStrategy`,
   `AuthenticatedUser`, `RolesGuard`, `@CurrentUser`.
3. auth entities + repositories (`account`, `account_role`, `one_time_token`,
   `outbox_event`) + migration (+ citext).
4. Outbox infra: `OutboxService` (write-in-TX) + BullMQ relay worker +
   `domain-events` queue.
5. AuthService rewrite: register (TX + outbox), verify-email, forgot/reset,
   resend, (OTP optional); move credential logic out of users.
6. Notifications stub provider (logging) behind a token.
7. users entities (`profile`, `address`) + repositories; `user.registered`
   consumer (idempotent profile create).
8. UsersService/Controller rewrite: `/users/me`, addresses CRUD, default-address
   logic; admin status/roles endpoints.
9. Seed: ensure first ADMIN account + role (adapt Phase 0 seed to the split).
10. Audit interceptor (login/reset/status/roles) → `audit` schema (minimal).
11. Tests: unit (services, guard, token) + e2e (register→verify→login→refresh→
    me→address→logout).

---

## 9. Definition of Done

- Full auth lifecycle works: register → (email) verify → login → refresh
  (rotating) → logout (revoked); forgot/reset revokes sessions.
- `GET/PATCH /users/me`, addresses CRUD with single-default enforcement.
- RBAC: `roles[]` in JWT; admin-only routes enforced; admin can set roles/status.
- Profile created via outbox (eventual consistency) and idempotent.
- Argon2id hashing; no user enumeration; strict throttling.
- Unit + e2e green; migrations run cleanly; seed creates the admin.

---

## 10. Decisions to confirm before coding

- **D3 — Hashing:** Argon2id (recommended) vs keep bcrypt.
- **D6 — Suspension enforcement:** eventual (refresh-revoke, ≤15m) vs immediate
  (per-request status/revocation check in `JwtStrategy`). Recommend **eventual**
  now, add a Redis revocation set later if needed.
- **OTP login:** include in Phase 1 or defer? Recommend **defer** (keep the
  `OTP_LOGIN` token purpose reserved; build endpoints later).
- **Email verification gating:** confirm login is allowed while unverified
  (recommended) and which later actions require verification.
