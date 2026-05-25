#!/bin/sh
set -e

echo "🔄 Applying schema (prisma db push)..."
npx prisma db push --accept-data-loss

echo "🚀 Starting API Gateway..."
exec node dist/main
