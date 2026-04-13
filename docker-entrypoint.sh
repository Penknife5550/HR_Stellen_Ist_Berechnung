#!/bin/sh
set -e

echo "=== Stellenistberechnung Container Start ==="

# Drizzle Migrations ausfuehren
echo "Running database migrations..."
node migrate.mjs

echo "Starting Next.js server..."
exec node server.js
