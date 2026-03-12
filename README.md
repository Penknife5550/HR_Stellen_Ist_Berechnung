# HR_Stellen_Ist_Berechnung

Stellenistberechnung fuer die CREDO/FES-Schulgruppe (NRW Ersatzschulen).

## Tech-Stack

- **Frontend/Backend:** Next.js 16 (App Router, React 19)
- **Datenbank:** PostgreSQL 16 + Drizzle ORM
- **Styling:** Tailwind CSS 4
- **Auth:** iron-session (verschluesselte Cookies)
- **Deployment:** Docker + Caddy Reverse Proxy

## Entwicklung

```bash
# Dependencies installieren
npm install

# Lokale DB starten (Docker)
docker compose up -d

# DB-Migrationen ausfuehren
npm run db:migrate

# Seed-Daten laden
npm run db:seed

# Dev-Server starten
npm run dev
```

## Production Deployment

```bash
# .env anlegen (siehe .env.example)
cp .env.example .env
# Werte anpassen!

# Production starten
docker compose -f docker-compose.prod.yml up -d --build
```

## Tests

```bash
npm run test
```
