# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ── deps: install only what api-gateway needs ────────────────────────────────
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
      --workspace=@qa-platform/api-gateway \
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
COPY apps/api-gateway/      ./apps/api-gateway/

# Build shared packages first — their dist/index.js is required at runtime
# via the node_modules/@qa-platform/* symlinks
WORKDIR /app/packages/shared-types
RUN /app/node_modules/.bin/tsc

WORKDIR /app/packages/shared-utils
RUN /app/node_modules/.bin/tsc

# Generate Prisma client and compile api-gateway
WORKDIR /app/apps/api-gateway
RUN /app/node_modules/.bin/prisma generate
RUN /app/node_modules/.bin/tsc --project tsconfig.build.json
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found after tsc build" && exit 1)
WORKDIR /app

# ── runner: lean production image ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api-gateway/dist ./dist
COPY --from=builder /app/node_modules                                 ./node_modules
COPY --from=builder /app/apps/api-gateway/prisma                      ./prisma
COPY --from=builder /app/packages/shared-types/                       ./packages/shared-types/
COPY --from=builder /app/packages/shared-utils/                       ./packages/shared-utils/
COPY --chown=nestjs:nodejs apps/api-gateway/entrypoint.sh             ./entrypoint.sh

# root needed to chmod the script, then drop back to nestjs
USER root
RUN chmod +x ./entrypoint.sh
USER nestjs

EXPOSE 4000
ENTRYPOINT ["sh", "./entrypoint.sh"]
