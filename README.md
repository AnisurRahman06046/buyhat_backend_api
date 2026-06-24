# NestJS Production Starter — Modular Monolith

A reusable, production-ready backend boilerplate. Start any project from here:
the cross-cutting infrastructure (config, database, caching, queues, auth,
RBAC, error handling, logging, health checks, Docker) is done and wired — you
just add feature modules.

Built as a **modular monolith** that is **microservice-ready**: modules are
isolated like services, talk only through each other's public service layer, and
never reach into another module's tables.

---

## Tech stack

| Concern            | Choice                                            |
| ------------------ | ------------------------------------------------- |
| Framework          | NestJS 11 (TypeScript)                             |
| Database           | PostgreSQL + TypeORM (migrations, no `synchronize`)|
| Cache / Queues     | Redis (ioredis) + BullMQ                           |
| Auth               | JWT access/refresh + Passport, RBAC roles guard   |
| Validation         | class-validator / class-transformer (global pipe) |
| Logging            | nestjs-pino (structured JSON; pretty in dev)       |
| Docs               | Swagger / OpenAPI at `/docs`                       |
| Rate limiting      | @nestjs/throttler                                  |
| Health             | @nestjs/terminus (DB + Redis probes)              |
| Packaging          | Multi-stage Dockerfile + docker-compose           |

---

## Architecture rules

1. **Modular monolith** — one deployable, many isolated modules.
2. **Each module is a mini-service** — owns its entities, repository, service,
   controller, DTOs.
3. **No cross-module DB access** — a module never imports another module's
   entity or repository, and never queries its tables.
4. **Communication via the service layer only** — modules import another
   module's **public barrel** (`modules/<name>/index.ts`), which exports just
   the service (+ public DTOs/types).
5. **Clean layering** — `controller → service → repository → entity`. Controllers
   are thin; business logic lives in services; persistence in repositories.
6. **Microservice-ready** — cross-aggregate references are stored as plain UUID
   columns (e.g. `userId`), **not** as cross-module foreign keys. Extracting a
   module later means swapping an in-process service call for a network call —
   no schema untangling.

---

## Project structure

```
src/
├── main.ts                  # Bootstrap: middleware, global pipes/filters/interceptors, Swagger
├── app.module.ts            # Composition root — wires infra + feature modules + global guards
│
├── config/                  # Typed configuration + env validation (fail-fast at boot)
│   ├── configuration.ts     #   ConfigService namespaces: app, db, redis, jwt, throttle
│   └── env.validation.ts    #   class-validator schema for all env vars
│
├── common/                  # Framework-level building blocks (no business logic)
│   ├── decorators/          #   @Public, @Roles, @CurrentUser
│   ├── dto/                 #   PaginationQueryDto
│   ├── entities/            #   BaseEntity (uuid id, timestamps, soft delete)
│   ├── enums/               #   Role
│   ├── filters/             #   AllExceptionsFilter, HttpExceptionFilter (uniform error envelope)
│   ├── guards/              #   JwtAuthGuard, RolesGuard
│   ├── interceptors/        #   ResponseInterceptor (success envelope), TimeoutInterceptor
│   ├── interfaces/          #   ApiResponse, JwtPayload, AuthenticatedRequest
│   └── utils/               #   buildPaginationMeta
│
├── database/                # TypeORM connection + CLI data-source + migrations
│
├── shared/                  # Shared infrastructure (global modules)
│   ├── redis/               #   RedisModule + RedisService (typed ioredis wrapper)
│   └── queue/               #   BullMQ QueueModule + example processor pattern
│
└── modules/                 # FEATURE MODULES — add yours here
    ├── auth/                #   register / login / refresh / me, JWT strategy  (reference)
    ├── users/               #   CRUD users  (reference: full controller→service→repo→dto)
    └── health/              #   liveness / readiness probes
```

`auth` and `users` are **reference modules** — fully-working examples of the
patterns. Keep, adapt, or delete them; copy their shape for new modules.

---

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env          # then edit secrets

# 3. Start Postgres + Redis (run the app on the host)
docker compose up -d postgres redis

# 4. Run migrations (after you create entities/migrations)
npm run migration:run

# 5. Develop
npm run start:dev
```

- API base path: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs` (non-production only)
- Health: `http://localhost:3000/health` · `…/live` · `…/ready`

### Everything in containers

```bash
docker compose up --build
```

---

## API conventions

**Every success** is wrapped by `ResponseInterceptor`:

```json
{ "success": true, "data": { /* ... */ }, "meta": { "timestamp": "…", "path": "…" } }
```

**Every error** is wrapped by the exception filters:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "…", "details": ["…"] }, "meta": { "timestamp": "…", "path": "…" } }
```

**Auth** — global `JwtAuthGuard` makes the app secure by default. Opt routes out
with `@Public()`. Restrict with `@Roles(Role.ADMIN)` (enforced by `RolesGuard`).
Read the principal with `@CurrentUser()`.

**Pagination** — extend `PaginationQueryDto`; return `{ data, pagination }` from
the service and the interceptor merges `pagination` into `meta`.

---

## Adding a new module

Mirror the `users` module — that is the whole point of the boilerplate:

```
modules/<name>/
├── <name>.module.ts         # TypeOrmModule.forFeature([...]); exports ONLY the service
├── controllers/             # thin HTTP layer, delegates to the service
├── services/                # business logic; the module's public entry point
├── repositories/            # TypeORM wrapper; the only place that touches the DB
├── entities/                # tables this module owns (extend BaseEntity)
├── dto/                     # request/response DTOs (validated)
└── index.ts                 # PUBLIC API barrel — what other modules may import
```

Then register it in the **FEATURE MODULES** block of `src/app.module.ts`.

**Cross-module rule:** to use another module, import its service from the barrel
(`import { UsersService } from '../users';`) — never its entity or repository.

---

## Migrations

`synchronize` is hard-disabled everywhere — schema changes go through migrations.

```bash
npm run migration:generate -- src/database/migrations/<Name>   # diff entities → migration
npm run migration:run                                          # apply
npm run migration:revert                                       # roll back last
```

---

## Scripts

| Script                      | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `npm run start:dev`         | Watch-mode dev server                    |
| `npm run build`             | Compile to `dist/`                       |
| `npm run start:prod`        | Run compiled app                         |
| `npm run lint`              | ESLint (type-aware) with autofix         |
| `npm test` / `test:e2e`     | Unit / end-to-end tests                  |
| `npm run migration:*`       | TypeORM migration CLI                    |

---

## Production checklist

- [ ] Set strong, unique `JWT_SECRET` / `JWT_REFRESH_SECRET` (`openssl rand -base64 48`).
- [ ] Lock `CORS_ORIGIN` to your real origins.
- [ ] Run behind TLS; keep `helmet` + `compression` (already enabled).
- [ ] Tune the DB pool (`database.module.ts` `extra.max`) and throttler limits.
- [ ] Persist/rotate refresh tokens (see the TODO in `auth.service.ts`) if you
      need server-side revocation.
- [ ] Back the throttler with Redis storage for multi-instance deployments.
- [ ] Wire `/health/live` and `/health/ready` to your orchestrator probes.