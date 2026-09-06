# Projekt Horus — Business Class Flight Deals

Findet, listet und (später) alarmiert bei Business-Class-Flugdeals ab Deutschland. Siehe das Konzept-/Phasen-Dokument für die Gesamtplanung; dieses README beschreibt nur das technische Setup.

## Struktur (Monorepo, pnpm workspaces)

```
apps/
  api/    Fastify-API (liest/schreibt über @horus/db)
  web/    Next.js-Frontend
packages/
  db/     Prisma-Schema, Migrationen, Seed-Skript (Airline-Longlist)
```

**Aktueller Stand (Phase 0 – Fundament):** DB-Schema, Airline-Longlist als Seed-Daten, minimale API (`/health`, `/airlines`) und eine Debug-Seite im Web-Frontend, die die Airlines aus der DB anzeigt. Die eigentliche Deal-Liste mit Filtern (Phase 2), Scraper (Phase 1), Karte (Phase 4) und Alerting (Phase 3) folgen in späteren Phasen.

## Voraussetzungen

- Node.js ≥ 20
- pnpm (`corepack enable` aktiviert die im `package.json` gepinnte Version automatisch)
- Docker (für lokale Postgres-DB)

## Lokales Setup

```bash
# 1. Dependencies installieren
pnpm install

# 2. Lokale Postgres-DB starten
docker compose up -d

# 3. Env-Datei anlegen
cp .env.example .env

# 4. DB-Schema migrieren + Airline-Longlist seeden
pnpm db:migrate
pnpm db:seed

# 5. API starten (Port 4000)
pnpm dev:api

# 6. In einem zweiten Terminal: Web-Frontend starten (Port 3000)
pnpm dev:web
```

Danach: `http://localhost:3000` zeigt die geseedete Airline-Longlist, `http://localhost:4000/health` und `http://localhost:4000/airlines` beantworten die API direkt.

## Weitere Kommandos

- `pnpm build` — baut alle Packages/Apps
- `pnpm lint` / `pnpm typecheck` — über alle Workspaces
- `pnpm --filter @horus/db studio` — Prisma Studio zum Datenbank-Browsing
