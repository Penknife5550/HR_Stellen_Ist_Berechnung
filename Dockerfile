# ============================================================
# Stellenistberechnung – Multi-Stage Docker Build
# ============================================================
# Stage 1: Dependencies installieren
# Stage 2: Next.js Build (standalone output)
# Stage 3: Minimales Production-Image
# ============================================================

# -----------------------------------------------------------
# Stage 1 – Dependencies
# -----------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Package-Dateien kopieren
COPY package.json package-lock.json* ./

# Nur Production + Build Dependencies installieren
RUN npm ci

# -----------------------------------------------------------
# Stage 2 – Build
# -----------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Dependencies aus Stage 1
COPY --from=deps /app/node_modules ./node_modules

# Source kopieren
COPY . .

# Build-Zeit Umgebungsvariablen (Next.js braucht diese beim Build)
# DATABASE_URL wird NICHT beim Build benoetigt (nur Runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Next.js Build (erzeugt .next/standalone)
RUN npm run build

# -----------------------------------------------------------
# Stage 3 – Production Runner
# -----------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Sicherheit: Non-root User
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone-Server (enthaelt alles Noetige)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Drizzle Migrations fuer Runtime (db:migrate beim Start)
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Non-root User verwenden
USER nextjs

EXPOSE 3000

# Next.js Standalone Server starten
CMD ["node", "server.js"]
