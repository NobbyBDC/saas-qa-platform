# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1

# ── deps: install web + shared packages ──────────────────────────────────────
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
      --workspace=@qa-platform/web \
      --legacy-peer-deps

# ── builder: compile Next.js ─────────────────────────────────────────────────
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
COPY apps/web/               ./apps/web/

# Build shared packages first
WORKDIR /app/packages/shared-types
RUN /app/node_modules/.bin/tsc

WORKDIR /app/packages/shared-utils
RUN /app/node_modules/.bin/tsc

# Build Next.js — outputFileTracingRoot is set to /app (the monorepo root),
# so standalone output will be structured relative to /app:
#   .next/standalone/apps/web/server.js
#   .next/standalone/node_modules/
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/web
RUN /app/node_modules/.bin/next build
WORKDIR /app

# ── runner: lean production image ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# outputFileTracingRoot=/app means standalone mirrors the monorepo structure:
#   standalone/apps/web/server.js  → /app/apps/web/server.js
#   standalone/node_modules/       → /app/node_modules/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Static assets go alongside server.js (relative to outputFileTracingRoot)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
