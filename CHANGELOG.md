# Changelog — Stellenistberechnung

## [0.4.0] — 2026-04-22

### Sync-Fix: Coverage-basierte Monat→Periode-Zuordnung

Beseitigt den taeglich wiederkehrenden Flip-Flop in der Aenderungshistorie
(`deputat_aenderungen`), der bei Lehrern mit Untis-Perioden, die denselben
Kalendermonat beruehren, sichtbar wurde.

**Problem (vor 0.4.0)**
Der Sync-Endpoint mappte jeden Untis-Periodenbereich auf *alle* Monate, die
er auch nur einen Tag beruehrte. Kamen pro Sync-Lauf mehrere Calls fuer
denselben Monat an (ein Call pro Periode), schrieb jeder Call den Monat
neu — last-write-wins, aber jede Aenderung landete in der History.
Konsequenz: pro Tag 2-3 invertierte History-Zeilen je betroffenem Monat
(z. B. Bergen Eduard: 4 unnoetige Zeilen/Tag).

**Loesung**
Neue Coverage-Regel: Pro Kalendermonat gewinnt die Periode mit den meisten
Tagen im Monat. Bei Gleichstand die chronologisch spaetere Periode. Gleiche
Periode (schoolyear+term) wird immer durchgelassen, damit Wertaenderungen
innerhalb einer Periode weiterhin erkannt werden.

**Migration** `0005_sync_period_coverage.sql`
Zwei neue Spalten in `deputat_monatlich`:
- `untis_term_date_from DATE`
- `untis_term_date_to DATE`

Zusammen mit der bereits vorhandenen (aber bisher nicht befuellten!)
`untis_schoolyear_id`-Spalte weiss jeder Monatseintrag jetzt, welche Periode
genau ihn geschrieben hat. Der Tie-Breaker vergleicht die Coverage der
eingehenden Periode gegen die gespeicherte.

**Neue Dateien**
- `src/lib/periodCoverage.ts` — `tageImMonat()`, `neuePeriodeGewinnt()`, `germanDateToIso()`
- `tests/lib/periodCoverage.test.ts` — 21 Unit-Tests
- `tests/lib/periodCoverageScenarios.test.ts` — 9 Regression-Szenarien (Bergens Maerz/April, HJ-Wechsel Januar)
- `cleanup-flipflop-history.mjs` — einmaliges Cleanup exakter Inverse-Paare (Dry-Run per Default, `--apply` fuer Loeschung)

**Geaenderte Dateien**
- `src/app/api/deputate/sync/route.ts` — Coverage-Check vor Wert-Vergleich; neue Spalten beim Upsert
- `src/lib/validation.ts` — `school_year_id` ins `syncPayloadSchema` (optional, Backwards-Compat)
- `src/db/schema.ts` — neue Drizzle-Spalten
- `03_n8n/#223 Stellenist Deputat-Sync.json` — sendet `school_year_id` im Payload
- `03_n8n/Backfill_HJ2025_HJ2026_Stellenist.json` — ebenfalls

**Deployment**
1. Migration `0005_sync_period_coverage.sql` laeuft automatisch beim Container-Start.
2. Naechster n8n-Sync befuellt Coverage-Felder korrekt und ersetzt fehlerhafte Term-Zuordnungen; bei gleichen Werten ohne History.
3. `cleanup-flipflop-history.mjs` einmalig ausfuehren (erst Dry-Run, dann `--apply`), um Altlasten in `deputat_aenderungen` zu entfernen.

---

## [0.3.0] — 2026-04-14

### N8N-Webhook-Verwaltung, Taggenaue Deputate, Schul-Mehrarbeit, Go-Live-Fix

Grosses Feature-Release. Alle drei Feature-Bereiche sind eigenstaendig nutzbar
und stehen fuer den produktiven Einsatz auf `deputat.fes-credo.de` bereit.

---

#### 1. Production-Fix (Go-Live-Blocker)

- **Dockerfile**: `postgres` + `bcryptjs` werden jetzt explizit aus der
  deps-Stage in die Runner-Stage kopiert (`/app/node_modules/...`).
  Next.js' Standalone-Output-Tracing erfasst `migrate.mjs` / `seed.mjs`
  nicht — ohne den Fix bricht der Container-Start mit
  `ERR_MODULE_NOT_FOUND: Cannot find package 'postgres'` ab.

- **`.env.production.example`** erweitert um:
  - `NOTIFICATION_DISPATCH_KEY` (neu, fuer Retry-Endpoint der
    ausgehenden Webhooks)
  - Hinweis zum automatisch deaktivierten ENV-`API_SYNC_KEY` nach
    Anlage des ersten DB-Keys.

---

#### 2. N8N-Webhook-Verwaltung (`/admin/n8n-webhooks`)

Grafische Admin-Oberflaeche fuer die komplette Steuerung der N8N-Anbindung —
Voraussetzung fuer kundenseitigen Betrieb (Verkaufsfaehigkeit).

**Neue DB-Tabellen** (Migration `0001_n8n_webhook_verwaltung.sql`):

- `webhook_configs` — eingehende Sync-Keys (bcrypt-Hash + 12-Zeichen-Praefix,
  aktiv-Flag, `last_used_at`, Audit-Trail).
- `notification_targets` — ausgehende Webhook-Ziele mit abonnierten Events,
  optionalem HMAC-Secret, Custom-Headern.
- `notification_log` — Versandprotokoll mit 3x Retry (1min / 5min / 15min
  Backoff), Fehlerdetails, HTTP-Status.

**Events:** `sync.completed`, `sync.failed`, `lehrer.created`,
`hauptdeputat.changed`. Aggregiert pro Sync (nicht pro Lehrer) — kein
Fan-out-Problem.

**Sicherheit** (nach Code-Review v0.3.0-H1..H5 behoben in
Migration `0002_webhook_fixes.sql`):

- **SSRF-Schutz** (`src/lib/urlSafety.ts`): Protokoll-Whitelist,
  DNS-Lookup mit Blocklist fuer private IP-Ranges (RFC1918, Loopback,
  Link-Local, CGNAT, ULA, Cloud-Metadata), `fetch(..., {redirect: "error"})`.
  Dev erlaubt localhost, Prod nicht. Opt-out via `WEBHOOK_ALLOW_PRIVATE=0`.
- **Atomares Dispatch-Claiming**: `UPDATE ... WHERE status='pending' RETURNING`
  — parallele Cron-Laeufe senden keine Duplikate.
- **Bootstrap-Fallback sicher**: ENV-`API_SYNC_KEY` greift nur solange
  noch **nie** ein Eintrag in `webhook_configs` angelegt wurde (Check
  gegen `audit_log`). Einmal aktiviert = dauerhaft deaktiviert.
- **timing-safe Key-Vergleich** (`crypto.timingSafeEqual`).
- **bcrypt async** (keine Event-Loop-Blockade).
- **FK `ON DELETE SET NULL`** statt Cascade — Historie bleibt erhalten.
- **Indizes**: `api_key_prefix` + Status-Filter auf Log.

**API:**

- `POST /api/deputate/sync` — pruefl gegen `webhook_configs` (Fallback ENV nur
  bei leerer audit_log-History), loest `sync.completed|failed` aus, aggregiert
  `lehrer.created` / `hauptdeputat.changed` pro Sync.
- `POST /api/notifications/dispatch` — Retry-Endpoint, Auth via
  Header `x-dispatch-key`. Wird vom N8N-Cron alle 2-5 Minuten getriggert.

**UI** (3 Tabs): Eingehend (Keys + Setup-Hinweis, Key-Anzeige nur einmalig),
Ausgehend (Ziele, Test-Button, Events), Protokolle (Sync-Historie +
Notification-Log mit Status-Filter + Paginierung).

---

#### 3. Taggenaue Deputate (§ 3 Abs. 1 FESchVO)

Wenn HR in `deputat_aenderungen.tatsaechliches_datum` ein Datum eintraegt,
wird das Monatsdeputat tagesgewichtet berechnet:

    effektiv = (alt / Monatstage x Tage vor Aenderung)
             + (neu / Monatstage x Tage ab Aenderung)

**Zentraler Helper** (`src/lib/berechnungen/deputatEffektiv.ts`):

- `berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, jahr)`
- Pro Spalte (Gesamt, GES, GYM, BK) unabhaengig — Multi-Schul-Lehrer
  werden korrekt gehandhabt (Linearitaet garantiert wenn
  `alt_gesamt = alt_ges + alt_gym + alt_bk`).
- Liefert pro Monat: `pauschal`, `effektiv`, `korrektur`, `hatKorrektur`,
  und Aufschluesselung je Aenderung (`tag`, `tageVor`, `tageNach`,
  `anteilAlt`, `anteilNeu`).

**Angewendet ueberall:**

- `/deputate/[id]` — rote `*`-Markierung + Tooltip + "Taggenaue Herleitung"-Card
  unterhalb der Tabelle (pro Monat Schritt-fuer-Schritt-Rechnung).
- `/deputate` — Liste mit `*`-Markierung + Tooltip.
- `/mitarbeiter` — Durchschnitt auf effektive Werte.
- Excel/PDF-Export (`/api/export/deputate`) — effektive Werte +
  Fussnoten-Hinweis wenn Korrekturen aktiv.
- `/stellenist` — Banner mit allen korrigierten Monaten der aktiven Schule
  (pauschal vs. effektiv + Delta).
- Stellenist-Berechnung nutzt `berechneTagesgenauKorrekturen` bereits aus
  der Vorversion — jetzt konsistent mit der UI-Anzeige.

**Beispiel Oskar Dyck, Feb 2026 (Testcase):**

- DB: `tatsaechliches_datum = 2026-02-09`, alt=23,5, neu=25,5 (GYM)
- Formel: `(23,5 x 8 + 25,5 x 20) / 28 = 24,9286`
- UI zeigt `24,9` rot mit `*` und Herleitung.

---

#### 4. Schul-Mehrarbeit (`/mehrarbeit`)

Neben der bestehenden Lehrer-Variante (Stunden) gibt es jetzt eine
schulweite Mehrarbeit-Erfassung direkt in Stellenanteilen.

**DB-Erweiterung** (Migrations `0003_mehrarbeit_schule.sql`,
`0004_mehrarbeit_check.sql`):

- `mehrarbeit.lehrerId` NULL-fahig (war NOT NULL).
- Neue Spalte `mehrarbeit.stellenanteil NUMERIC(8,4)`.
- Neue Tabelle `mehrarbeit_schule_bemerkung` — Freitext pro Schule+HJ.
- Zwei **partielle Unique-Indizes** trennen die Varianten:
  - `mehrarbeit_lehrer_unique` WHERE `lehrer_id IS NOT NULL`
  - `mehrarbeit_schule_unique` WHERE `lehrer_id IS NULL`
- **CHECK-Constraint `mehrarbeit_variante_check`** erzwingt die zwei
  validen Zustaende (Lehrer-Variante: stunden gesetzt / stellenanteil NULL;
  Schul-Variante: stellenanteil gesetzt / stunden=0 / lehrerId NULL;
  `schule_id` in beiden Varianten NOT NULL).

**UI:**

- Tab "Pro Schule" (`SchulMehrarbeitTable.tsx`) — Matrix Schulen x Monate,
  Inline-Edit 4-Nachkommastellen, Auto-Save bei Blur/Enter mit
  Change-Detection, Bemerkung pro Schule+HJ, Footer mit Spaltensummen +
  Jahres-Gesamtsumme.
- Tab "Pro Lehrkraft" — bestehende Variante in Stunden.
- Menue-Eintrag **"Mehrarbeit"** in der Sidebar zwischen Deputate und
  Nachtraege.

**Stellenist-Integration** (`src/lib/berechnungen/stellenist.ts`):

- Neues Input-Feld `mehrarbeitStellen`.
- Schulweite Stellenanteile werden **1:1** gemittelt (Summe / Monate
  im Zeitraum), nicht ueber Regeldeputat umgerechnet.
- Lehrer-Mehrarbeit (Stunden) bleibt wie gehabt (`/ (7 bzw. 5 x Regeldeputat)`).
- Stellenist-Detail-Ansicht zeigt beide Quellen nebeneinander:
  "davon aus Lehrer-Stunden: X h / davon aus Schul-Stellenanteilen: Y Stellen".

**Upsert** (`upsertMehrarbeit` + `upsertMehrarbeitSchule`):

- Manuelles SELECT+INSERT/UPDATE mit `FOR UPDATE`-Row-Lock
  (Drizzle kann partielle Indizes nicht als `onConflictDoUpdate`-Target
  nutzen).
- Korrekte Audit-Action-Labels (`insert` / `update` / `delete` / `noop`).

---

#### Migrations-Reihenfolge (Production)

1. `0000_white_thunderbolt_ross.sql` — Initial-Schema
2. `0001_n8n_webhook_verwaltung.sql` — Webhook-Tabellen
3. `0002_webhook_fixes.sql` — SET NULL + Prefix-Index
4. `0003_mehrarbeit_schule.sql` — Mehrarbeit erweitert, Bemerkung-Tabelle
5. `0004_mehrarbeit_check.sql` — CHECK-Constraint fuer Varianten

Alle Migrations laufen automatisch via `migrate.mjs` beim Container-Start.

---

#### Go-Live-Checkliste

1. `git pull` im Server-Verzeichnis
2. `.env` ergaenzen um `NOTIFICATION_DISPATCH_KEY=<openssl rand -hex 32>`
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. Logs: `docker compose -f docker-compose.prod.yml logs -f app`
5. (Frische DB) `docker compose exec app node seed.mjs`
6. Admin-Login unter `/admin/n8n-webhooks` → ersten Sync-Key anlegen und
   in N8N-Workflow eintragen
7. N8N-Cron fuer `POST /api/notifications/dispatch` alle 2-5 Minuten
   einrichten (Header `x-dispatch-key`)

---

## [0.2.0] — 2026-03-31

### Berechnungs-Audit gegen NRW-Rechtsgrundlagen

Vollstaendiger Abgleich der Berechnungslogik gegen das Dokument
`01_Content/Berechnung` (§ 3 FESchVO, § 107 SchulG NRW, AVO-RL).

#### Bugfixes (kritisch)

- **Regeldeputat Grundschulen korrigiert** (F1, HOCH):
  GSH/GSM/GSS erhalten jetzt korrekt **28.0 Wochenstunden** statt
  dem falschen Fallback 25.5. Ohne diesen Fix waere das Stellenist
  fuer Grundschulen um ~1 Stelle pro 10 Lehrer ueberzaehlt.
  Rechtsgrundlage: § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW.
  (`src/app/stellenist/actions.ts`)

- **Cross-School-Deputat-Fix** (KRITISCH):
  Lehrer die schuluebergreifend eingesetzt werden (z.B. 20h GES + 5h GYM)
  wurden mit allen 25h der Stammschule zugerechnet. Jetzt wird die
  schulspezifische Spalte (`deputat_ges`/`deputat_gym`/`deputat_bk`)
  ueber ALLE Lehrer summiert — nicht nur Stammschul-Lehrer.
  Neue Query `getDeputatSummenBySchule()` in `src/lib/db/queries.ts`.
  Rechtsgrundlage: § 3 Abs. 1 FESchVO — Stellenist basiert auf den
  tatsaechlich an der Schule erteilten Unterrichtsstunden.

#### Neue Features

- **SLR-Konfiguration editierbar**:
  Inline-Bearbeitung, Hinzufuegen, Loeschen von SLR-Werten.
  Jede Aenderung wird versioniert (Tabelle `slr_historie`) mit
  Pflicht-Aenderungsgrund. Aenderungshistorie pro Schuljahr einsehbar.
  (`src/app/slr-konfiguration/`)

- **Deputat-Aenderungserkennung**:
  Bei jedem n8n-Sync werden Aenderungen automatisch erkannt:
  - `deputat_aenderung` = PlannedWeek geaendert (gehaltsrelevant)
  - `verteilung_aenderung` = Nur Schulverteilung geaendert
  Neue Tabelle `deputat_aenderungen` mit komplettem Audit-Trail.
  (`src/app/api/deputate/sync/route.ts`)

- **Lehrkraft-Detail-Seite** (`/deputate/[id]`):
  Monats-Timeline mit Schulverteilung (GES/GYM/BK) pro Monat,
  Untis-Perioden-Anzeige, Aenderungshistorie mit Inline-Datumskorrektur.
  Gehaltsrelevante Aenderungen werden rot hervorgehoben.

- **Tatsaechliches Aenderungsdatum** (manuell korrigierbar):
  Untis erzwingt Aenderungen zum Montag. HR kann das reale Datum
  taggenau setzen. Wird protokolliert (wer, wann).
  Rechtsgrundlage: § 3 Abs. 1 FESchVO — tagegenaue Erfassung.
  (`src/app/deputate/actions.ts`, `src/app/deputate/[id]/AenderungsHistorie.tsx`)

- **Deputatsuebersicht erweitert**:
  - Schulspezifische Deputat-Info hinter Lehrernamen: `Becker Martin (21.5 + GYM 4.0)`
  - Filter "Gehaltsaenderungen" (roter Button) zeigt nur betroffene Lehrer
  - Roter/gelber Punkt neben Namen bei Aenderungen
  - Lehrernamen klickbar → Detail-Seite

- **Rechtsgrundlagen-Hinweise in der UI**:
  Alle relevanten Seiten zeigen die gesetzlichen Grundlagen:
  - Stellensoll: § 3 FESchVO, § 107 SchulG, AVO-RL Nr. 7.1.1
  - Stellenist: § 3 Abs. 1 FESchVO, § 2 VO zu § 93 Abs. 2 SchulG
  - SLR: § 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349)
  - Zuschlaege: § 107 Abs. 3 SchulG, § 3a FESchVO
  - Vergleich: § 107 Abs. 2 SchulG, Art. 8 Abs. 4 LV NRW

#### n8n-Integration

- **Sync-Endpoint Performance** (176 Lehrer in <1 Sek statt 60+ Sek Timeout):
  Batch-Laden aller Lehrer in einem Query, Transaktions-Batches (50er),
  Upsert statt SELECT+INSERT fuer Deputate.

- **Multi-Perioden-SQL-Query**:
  Neue SQL holt ALLE Perioden beider Schuljahre die das Haushaltsjahr
  abdecken (altes SJ fuer Jan-Jul, neues SJ fuer Aug-Dez).
  Code-Node gruppiert nach Periode und sendet je einen API-Call.

- **Stammschul-Filter im Sync**:
  Lehrer mit unbekannter Stammschule (z.B. Code "Z") werden
  automatisch uebersprungen.

#### Seed-Daten erweitert

- BK-SLR-Werte: Berufskolleg Teilzeit (41.64), Vollzeit (16.18)
- Gymnasium G8 SLR (19.17) ergaenzt
- BK Schulstufe korrigiert: `Berufskolleg` → `Berufskolleg Vollzeit`
- SLR-Quellen praezisiert: `§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)`

#### Tests

- 49/49 Unit Tests bestanden (Berechnungslogik unveraendert)
- E2E-Berechnungstest: `tests/e2e-berechnung.ts` (22 Tests)
- Cross-School-Verifikation: schulspezifische Stunden korrekt verteilt
- Regeldeputat-Fix verifiziert: 28.0 vs 25.5 Differenz nachgewiesen

### Dateien geaendert

```
src/app/api/deputate/sync/route.ts    — Performance + Aenderungserkennung + Stammschul-Filter
src/app/deputate/page.tsx              — Schulspez. Info + Gehaltsaenderungs-Banner
src/app/deputate/DeputateClient.tsx    — Deputat-Info, Filter, klickbare Namen
src/app/deputate/actions.ts            — NEU: Datumskorrektur Server Action
src/app/deputate/[id]/page.tsx         — NEU: Lehrkraft-Detail-Seite
src/app/deputate/[id]/AenderungsHistorie.tsx — NEU: Inline-Datumsbearbeitung
src/app/slr-konfiguration/page.tsx     — Historie-Daten laden
src/app/slr-konfiguration/SlrClient.tsx — Inline-Edit + Historie + Hinzufuegen/Loeschen
src/app/slr-konfiguration/actions.ts   — NEU: SLR CRUD mit Versionierung
src/app/stellenist/actions.ts          — Regeldeputat GS 28.0 + schulspez. Query
src/app/stellenist/page.tsx            — Rechtsgrundlage im Subtitle
src/app/stellenist/StellenistClient.tsx — Rechtsgrundlagen-Hinweis
src/app/stellensoll/page.tsx           — Rechtsgrundlagen-Box
src/app/stellensoll/StellensollClient.tsx — Rechtsgrundlagen bei Rundung
src/app/vergleich/page.tsx             — Rechtsgrundlagen erweitert
src/app/zuschlaege/page.tsx            — Rechtsgrundlagen-Box
src/db/schema.ts                       — slrHistorie + deputatAenderungen Tabellen
src/db/seed.ts                         — BK/G8 SLR + korrigierter schulformTyp
src/lib/constants.ts                   — BK + G8 SLR-Defaults
src/lib/db/queries.ts                  — getDeputatSummenBySchule + Aenderungs-Queries
docker-compose.yml                     — Port 5434 (Kollision mit HR-Portal vermeiden)
03_n8n/#223...json                     — Multi-Perioden SQL + Perioden-Gruppierung
tests/e2e-berechnung.ts                — NEU: E2E-Berechnungstest
```
