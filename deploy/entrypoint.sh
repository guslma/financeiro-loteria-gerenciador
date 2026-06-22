#!/bin/sh
set -e

npx prisma migrate deploy
node scripts/seed.mjs

exec node server.js
