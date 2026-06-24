# syntax=docker/dockerfile:1

# ---- Base ----------------------------------------------------------------
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---- Dependencies (all, for build) --------------------------------------
FROM base AS deps
COPY package*.json ./
RUN npm ci

# ---- Build ---------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# ---- Production dependencies only ---------------------------------------
FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runner --------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# Non-root for safety
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
USER node
EXPOSE 3000
# Migrations can be run as a separate step/job:  npm run migration:run:prod
CMD ["node", "dist/main"]
