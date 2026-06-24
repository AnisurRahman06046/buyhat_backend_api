# Production-Readiness Review — NestJS + PostgreSQL + TypeORM

> Senior backend architecture review. Scope: clean architecture, SOLID, NestJS
> best practices, TypeORM correctness, security, performance, code quality.
> Date: 2026-06-23.

---

## 1. Critical Issues

**Health routes are unreachable at their documented/probed paths**
- File: `src/main.ts` (`enableVersioning` + `setGlobalPrefix('api', { exclude: [...] })`) + `src/modules/health/health.controller.ts`
- Impact: `exclude` only strips the `api` prefix, **not** the version segment. With URI versioning (default `'1'`), health resolves to `/v1/health/*`, not `/health/*`. K8s/LB probes and the e2e test hit `/health/live` → **404**. Liveness/readiness silently broken in prod.
- Fix: mark the controller version-neutral:
  ```ts
  @Controller({ path: 'health', version: VERSION_NEUTRAL })
  ```

**CORS misconfigured: wildcard origin + credentials**
- File: `src/main.ts` (`enableCors({ origin: '*', credentials: true })`), default from `src/config/configuration.ts` (`corsOrigin: '*'`)
- Impact: `Access-Control-Allow-Origin: *` with `Allow-Credentials: true` is rejected by browsers; cookie/credentialed auth breaks, and a wildcard is an unsafe default for a credentialed API.
- Fix: require an explicit origin list in non-dev; never pair `*` with `credentials: true`. Validate `CORS_ORIGIN` is set in production.

**UUID PK depends on an extension that isn't guaranteed**
- File: `src/common/entities/base.entity.ts` (`@PrimaryGeneratedColumn('uuid')`)
- Impact: TypeORM emits `uuid_generate_v4()` (needs `uuid-ossp`). On a clean Postgres without it, every insert/migration fails at runtime.
- Fix: add a first migration `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` (or switch to `gen_random_uuid()` / pgcrypto). Don't leave it implicit.

**No brute-force protection on login**
- File: `src/modules/auth/controllers/auth.controller.ts`
- Impact: global throttler (100 req / 60s) is far too lenient for credential stuffing against `/auth/login`.
- Fix: per-route `@Throttle({ default: { limit: 5, ttl: 60_000 } })` on login/register/refresh.

---

## 2. Important Issues

**Two overlapping global exception filters; correctness depends on registration order**
- File: `src/main.ts`, `src/common/filters/all-exceptions.filter.ts` (`@Catch()` already handles `HttpException`) + `src/common/filters/http-exception.filter.ts`
- Fix: register **one** filter. Fold the validation-array→`details` handling into `AllExceptionsFilter` and drop the second; eliminates the ordering hazard where the catch-all shadows the specific filter and drops validation `details`.

**Throttler uses in-memory storage**
- File: `src/app.module.ts`
- Fix: use `@nest-lab/throttler-storage-redis` (Redis already present) or limits are per-instance and ineffective behind >1 replica.

**Soft-delete + unique email collide**
- File: `src/modules/users/entities/user.entity.ts`
- Fix: the unique index spans soft-deleted rows, so a deleted user's email can never be reused. Use a partial unique index: `@Index(..., { unique: true, where: '"deleted_at" IS NULL' })`.

**Weak JWT secret accepted**
- File: `src/config/env.validation.ts`
- Fix: enforce `@MinLength(32)` on `JWT_SECRET`/`JWT_REFRESH_SECRET`; a 1-char secret currently passes validation.

**Refresh tokens are unrevocable / non-rotating**
- File: `src/modules/auth/services/auth.service.ts` (acknowledged TODO)
- Fix: store a `jti` in Redis, rotate on use, reject reuse. Without it, logout/compromise can't invalidate a token for its full 7-day life.

**`ResponseInterceptor` wraps Terminus health output**
- File: `src/common/interceptors/response.interceptor.ts`
- Fix: Terminus owns its `{status, info, details}` shape; wrapping it in `{success,data}` breaks tools that parse health JSON. Exclude health (or use reflector bypass) — and `@SkipThrottle()` it too.

**Duplicate-email check is TOCTOU and maps to wrong status**
- File: `src/modules/users/services/users.service.ts` + `src/common/filters/all-exceptions.filter.ts`
- Fix: rely on the DB unique constraint; translate Postgres `23505` to **409 Conflict** (currently any `QueryFailedError` → generic 400).

---

## 3. Minor Issues

- Login leaks user existence via timing (no `bcrypt.compare` when user missing) → compare against a dummy hash. `src/modules/auth/services/auth.service.ts`
- Offset pagination (`skip/take`) degrades on deep pages → document/keyset for hot lists. `src/modules/users/repositories/users.repository.ts`
- Filters read `process.env.NODE_ENV` directly instead of `ConfigService` → small coupling/test-friction. `src/common/filters/all-exceptions.filter.ts`
- `enableImplicitConversion: true` can coerce unexpected types past intent → prefer explicit `@Type()` only. `src/main.ts`
- No request correlation id in pino (`genReqId`) → harder prod tracing.
- `data-source.ts` entity glob is cwd-relative (`src/**`, `dist/**`) → brittle for migration runs in some CWDs.
- No DB indexes beyond unique email (e.g. `role`, `isActive` if filtered).

---

## 4. Good Practices

- Secure-by-default: global `JwtAuthGuard` + `@Public()` opt-out; `RolesGuard` RBAC.
- Clean layering enforced: `controller → service → repository`; repository wraps TypeORM (DIP).
- Real module boundaries: per-module public `index.ts` barrels; cross-module via service only; UUID refs not cross-module FKs (microservice-ready).
- Uniform success/error envelope; fail-fast env validation at boot.
- `synchronize: false` + migrations; `passwordHash` `select: false`; soft-delete base entity.
- Multi-stage **non-root** Docker + `dumb-init`; healthcheck-gated compose; helmet, compression, pino with auth/cookie redaction; graceful shutdown hooks.

---

## 5. Scores

- **Architecture: 8/10** — boundaries, layering, and DI are genuinely well done; lose points for the fragile dual-filter setup and minor cross-cutting coupling.
- **Production readiness: 6/10** — solid scaffolding, but the health-versioning break, CORS combo, UUID-extension gap, and missing login throttling/refresh revocation are real blockers for "real traffic."

---

## 6. Top 10 Fixes

1. `VERSION_NEUTRAL` on `HealthController` — restore `/health/*` for probes.
2. Add `CREATE EXTENSION "uuid-ossp"` migration (or `gen_random_uuid()`).
3. Lock CORS: explicit origins in prod, never `*` + credentials.
4. Stricter `@Throttle` on `/auth/login|register|refresh`.
5. Collapse to a single exception filter (keep validation `details`).
6. Redis-backed throttler storage for multi-replica.
7. Partial unique index on `users.email WHERE deleted_at IS NULL`.
8. Enforce `@MinLength(32)` on JWT secrets.
9. Refresh-token `jti` in Redis with rotation + revocation.
10. Map Postgres `23505` → 409; rely on DB constraint, not pre-check.