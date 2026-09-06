# Projekt Horus — Business Class Flight Deals

Findet, listet und (später) alarmiert bei Business-Class-Flugdeals ab Deutschland. Siehe das Konzept-/Phasen-Dokument für die Gesamtplanung; dieses README beschreibt nur das technische Setup.

## Struktur (Monorepo, pnpm workspaces)

```
apps/
  api/    Fastify-API (liest/schreibt über @horus/db)
  web/    Next.js-Frontend (Deal-Liste mit Filtern)
  worker/ Ingestion: Foren-/RSS-Crawler + Duffel-Flight-API-Client + Baseline-Preis-Engine
packages/
  db/     Prisma-Schema, Migrationen, Seed-Skript (Airline-/Airport-Longlist)
```

**Aktueller Stand:** Kern-MVP (Phase 0–2) ist fertig — DB-Schema, 33 Airlines + 39 Airports als Seed-Daten, Deal-Liste mit Filtern (Von/Nach, Airline, Rating, Preis, Ersparnis-%, Haul-Typ), Clickout-Links. Ingestion läuft über zwei Quellen: Foren/RSS (community-kuratierte Deals, sofort als Deal übernommen) und die [Duffel](https://duffel.com) Flight-API (rohe Preisbeobachtungen, die die Baseline-Engine gegen historische Preise vergleicht, um echte Abweichungen als Deal zu markieren). Google-Flights-Scraping wurde versucht und verworfen (IP-Block, siehe `apps/worker/src/googleFlightsScraper.ts`-Kommentar) — Karte (Phase 4) und Alerting (Phase 3) folgen später.

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

Danach: `http://localhost:3000` zeigt die Deal-Liste (anfangs leer, bis der Worker gelaufen ist), `http://localhost:3000/airlines` die Airline-Longlist, `http://localhost:4000/health` beantwortet die API direkt.

## Ingestion (echte Deals holen)

```bash
# In apps/worker/.env: DUFFEL_ACCESS_TOKEN=duffel_test_... setzen
# (kostenloser Test-Account auf duffel.com, siehe Anleitung im Projekt-Chat)

pnpm --filter @horus/worker start
```

Läuft ohne `DUFFEL_ACCESS_TOKEN` auch (überspringt dann nur die Duffel-Abfrage und crawlt weiter die Foren-Quellen). Deals brauchen mindestens 3 Preisbeobachtungen für dieselbe Airline/Route/Cabin-Kombination, bevor die Baseline-Engine eine Abweichung erkennen kann — deshalb fragt der Worker mehrere Abflugdaten pro Route ab.

## Weitere Kommandos

- `pnpm build` — baut alle Packages/Apps
- `pnpm lint` / `pnpm typecheck` — über alle Workspaces
- `pnpm --filter @horus/db studio` — Prisma Studio zum Datenbank-Browsing
