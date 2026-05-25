# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── deps: install only what security-service needs ───────────────────────────
FROM base AS deps
COPY package.json ./
COPY apps/api-gateway/package.json       ./apps/api-gateway/package.json
COPY apps/figma-service/package.json     ./apps/figma-service/package.json
COPY apps/codegen-service/package.json   ./apps/codegen-service/package.json
COPY apps/testing-service/package.json   ./apps/testing-service/package.json
COPY apps/security-service/package.json  ./apps/security-service/package.json
COPY apps/reporting-service/package.json ./apps/reporting-service/package.json
COPY apps/web/package.json               ./apps/web/package.json
COPY packages/shared-types/package.json  ./packages/shared-types/package.json
COPY packages/shared-utils/package.json  ./packages/shared-utils/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm install \
      --workspace=@qa-platform/security-service \
      --ignore-scripts \
      --legacy-peer-deps

# ── builder: compile TypeScript ──────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./
COPY apps/api-gateway/package.json       ./apps/api-gateway/package.json
COPY apps/figma-service/package.json     ./apps/figma-service/package.json
COPY apps/codegen-service/package.json   ./apps/codegen-service/package.json
COPY apps/testing-service/package.json   ./apps/testing-service/package.json
COPY apps/security-service/package.json  ./apps/security-service/package.json
COPY apps/reporting-service/package.json ./apps/reporting-service/package.json
COPY apps/web/package.json               ./apps/web/package.json
COPY packages/shared-types/package.json  ./packages/shared-types/package.json
COPY packages/shared-utils/package.json  ./packages/shared-utils/package.json

COPY packages/shared-types/ ./packages/shared-types/
COPY packages/shared-utils/ ./packages/shared-utils/
COPY apps/security-service/ ./apps/security-service/

# Build shared packages first — their dist/index.js is required at runtime
WORKDIR /app/packages/shared-types
RUN /app/node_modules/.bin/tsc

WORKDIR /app/packages/shared-utils
RUN /app/node_modules/.bin/tsc

# Compile security-service
WORKDIR /app/apps/security-service
RUN /app/node_modules/.bin/tsc --project tsconfig.build.json
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after tsc build" && exit 1)
WORKDIR /app

# ── runner: lean production image ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/security-service/dist ./dist
COPY --from=builder /app/node_modules                                      ./node_modules
COPY --from=builder /app/packages/shared-types/                           ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/                           ./packages/shared-utils/

USER nestjs
EXPOSE 4004
CMD ["node", "dist/main"]
