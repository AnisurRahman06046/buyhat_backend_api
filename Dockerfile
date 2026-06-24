# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────
# Multi-stage build → small, non-root production image.
# ──────────────────────────────────────────────────────────────────────────

# 1) deps: install ALL deps (incl. dev) for building, cached on lockfile only.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) build: compile TypeScript → dist
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) prod-deps: install ONLY production dependencies
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 4) runner: minimal runtime image
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# dumb-init for correct PID 1 signal handling (graceful shutdown).
RUN apk add --no-cache dumb-init

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Run as the built-in unprivileged `node` user.
USER node

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]