# Phase 10 — Notifications (full multi-channel)

> Real notification pipeline replacing the Phase 1 logging stub: multi-channel
> (EMAIL / SMS / PUSH) adapters behind a port, a BullMQ queue with retry/backoff,
> DB-overridable templates, per-user opt-out preferences, and an append-only
> delivery log. Existing call sites (auth, inventory) + new ones (orders, cart)
> fire via a single `NotificationService.dispatch` seam.
> **Depends on:** Phase 1 stub. **Date:** 2026-06-26. Schema: `notifications`.

---

## 1. Scope

- **Channels**: EMAIL, SMS, PUSH behind the existing `NOTIFICATION_PROVIDER` port
  (extended with `sendPush`). Default = `LoggingNotificationProvider` (no creds
  here); real SMTP / Twilio / FCM adapters deferred, like payments' MOCK gateway.
- **Dispatch seam** (D59): `NotificationService.dispatch({ event, userId?, to, data })`
  resolves the event's channels + templates, renders them, checks preferences,
  writes a `notification` (delivery-log) row, and enqueues a BullMQ job. The
  processor sends via the channel adapter and marks SENT/FAILED with retries.
- **Templates**: `notification_template` (event+channel) **overrides** in-code
  defaults; `{{var}}` substitution. Works even before any DB row is seeded.
- **Preferences** (D60): transactional messages always send; marketing respects
  per-user per-channel opt-out.
- **Endpoints**: manual send, template read/update, delivery-log read (staff);
  preferences (user).

---

## 2. Decisions (continue the D-series)

| # | Decision | Choice |
| --- | --- | --- |
| **D59** | Trigger model | **Direct dispatch seam.** Call sites call `NotificationService.dispatch(...)`, replacing the Phase 1 stub. Pipeline: template → preference → BullMQ → adapter → delivery log. (Outbox-event variant deferred.) |
| **D60** | Preferences | **Included.** `notification_preference` (per user, per channel marketing flags) + `GET/PUT /notifications/preferences`. TRANSACTIONAL ignores prefs; MARKETING honours opt-out. |
| **D61** | Providers | Unified `NotificationProvider` port (`sendEmail`/`sendSms`/`sendPush`) kept; default `LoggingNotificationProvider`. Real adapters (SMTP/Twilio/FCM) drop in behind the token later (no caller change). |
| **D62** | Templates | `notification_template (event, channel)` **overrides** the in-code default registry; render = `{{key}}` replace. System works with zero DB templates (defaults), so no seed dependency. |
| **D63** | Retry / log | BullMQ global defaults (`attempts:3`, exponential backoff). One `notification` row per channel per dispatch; processor marks SENT on success, FAILED after the last failed attempt; `attempts`/`error` recorded. |
| **D64** | Contact resolution | Callers pass a resolved `to` (auth/inventory already have the address; orders/cart resolve via new one-way **`UsersService.getContactInfo(userId)`** → `{email, phone}`). Notifications stays decoupled from auth/users (no module cycle); preferences key off `userId` only. |
| **D65** | Roles | Manual send + template edit = **ADMIN + MARKETING_MANAGER** (`NOTIFICATIONS_ADMIN_ROLES`); delivery-log read also allows **CUSTOMER_SUPPORT** (`NOTIFICATIONS_VIEW_ROLES`). Preferences = the authenticated user. |

> Events & categories (`notification-events.ts`): `auth.verify_email`,
> `auth.password_reset` (TRANSACTIONAL, EMAIL); `order.paid`, `order.shipped`,
> `order.delivered` (TRANSACTIONAL, EMAIL); `cart.abandoned` (MARKETING, EMAIL);
> `inventory.low_stock` (TRANSACTIONAL/internal, EMAIL). Each maps to category +
> channels + a default template per channel.

---

## 3. Schema (`notifications` schema; enums as **varchar**)

- `notification_template`: `event`, `channel`, `subject?`, `body`, `is_active`;
  unique `(event, channel)`.
- `notification` (delivery log): `user_id?`, `channel`, `recipient`, `event`,
  `category`, `subject?`, `body`, `status` (PENDING/SENT/FAILED), `attempts`,
  `error?`, `provider`, `sent_at?`. Index `(status)`, `(user_id)`.
- `notification_preference`: `user_id` **unique**, `marketing_email`,
  `marketing_sms`, `marketing_push` (bool, default true).

Migration `1782520000000-CreateNotificationsTables`.

```
NotificationChannel:  EMAIL | SMS | PUSH
NotificationCategory: TRANSACTIONAL | MARKETING
NotificationStatus:   PENDING → SENT | FAILED
```

## 4. Flow & cross-module seams

```
caller.dispatch({event,userId?,to,data})
  → resolve event def (category, channels, default templates)
  → per channel: [MARKETING? check preference] → render (DB template ?? default)
       → INSERT notification(PENDING) → queue.add({notificationId})
  → NotificationProcessor: load → provider.send<channel> → SENT
       (throw → BullMQ retry; last failure → FAILED)
```

- **new** `UsersService.getContactInfo(userId)` → `{email, phone}` (orders/cart).
- **rewired** call sites → `dispatch`: auth (verify/reset), inventory (low_stock),
  **+new** orders (`order.paid` from `markPaid`/`confirmOrder`), cart-sweeper
  (`cart.abandoned`).
- `NotificationsModule` is **@Global**, exports `NotificationService` (so any
  module injects it without importing). Registers the `notifications` BullMQ queue.

## 5. Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/notifications/email` \| `/sms` \| `/push` | staff | Ad-hoc send (through the real pipeline) |
| GET | `/notifications` | staff (view) | Delivery log (filter status/channel, paginated) |
| GET | `/notifications/templates` | staff | List templates (defaults + overrides) |
| PATCH | `/notifications/templates/:id` | staff | Edit/override a template |
| GET/PUT | `/notifications/preferences` | user | Read / update own opt-out prefs |

## 6. Edge cases

| Edge case | Handling |
| --- | --- |
| Provider throws | BullMQ retries (3×, exp backoff); FAILED + error logged after last attempt (D63) |
| User opted out of marketing | dispatch skips that channel for MARKETING events (D60/D65) |
| No contact for channel | dispatch skips the channel + records nothing (or a SKIPPED log) — never throws into the caller |
| No DB template | falls back to the in-code default template (D62) |
| Caller fire-and-forget | `dispatch` is best-effort from callers (`void`); never breaks the business txn |

## 7. Build order
extend provider port (+push) → enums + event registry + default templates →
entities + migration → repositories → DTOs → services (Notification dispatch +
delivery, Preference, Template) → BullMQ processor → controllers → @Global module
+ queue registration + app wiring → users `getContactInfo` seam → rewire call
sites (auth/inventory/orders/cart) → unit specs + e2e boot smoke.

**DoD:** order-paid + OTP/verify + abandoned-cart events deliver via the pipeline
(Log adapter here); failures retry and land in the delivery log; marketing opt-out
honoured; build + lint + tests + e2e green.
