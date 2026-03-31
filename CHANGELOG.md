# Changelog — Stellenistberechnung

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
