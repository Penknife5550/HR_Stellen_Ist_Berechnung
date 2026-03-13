# Stellenistberechnung - Vollstaendige Projektdokumentation

> **Stand:** 12. Maerz 2026
> **Version:** 0.1.0
> **Projekt:** CREDO/FES Stellenistberechnung

---

## 1. Projekt-Ueberblick

### 1.1 Zweck
Webanwendung zur Berechnung der Stellenistberechnung (Personalstellen) fuer die CREDO/FES-Schulgruppe (Christlicher Schulverein Minden e.V.) als Ersatzschultraeger in NRW. Ersetzt den bisherigen manuellen Excel-Prozess.

### 1.2 Zielgruppe
Personalabteilung der CREDO Verwaltung, Alter 40-60 Jahre. Daher: klare, grosse UI, deutsche Beschriftung, keine versteckten Menues.

### 1.3 Tech-Stack

| Bereich | Technologie | Version |
|---------|-------------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Frontend | React | 19.2.3 |
| Sprache | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| ORM | Drizzle ORM | 0.45.1 |
| Datenbank | PostgreSQL | 16 (Alpine) |
| Validierung | Zod | 4.3.6 |
| Auth | iron-session | 8.0.4 |
| Passwort-Hashing | bcryptjs | 3.0.3 |
| Icons | Lucide React | 0.577.0 |
| Datumslogik | date-fns | 4.1.0 |
| Tests | Vitest | 4.0.18 |
| Deployment | Docker + Caddy | node:22-alpine |

### 1.4 Projektstruktur

```
stellenistberechnung/
+-- src/
|   +-- app/                    # Next.js App Router (16 Seiten)
|   |   +-- login/              # Login-Seite
|   |   +-- dashboard/          # Dashboard mit KPIs
|   |   +-- schuelerzahlen/     # Schuelerzahlen verwalten
|   |   +-- slr-konfiguration/  # SLR-Werte pflegen
|   |   +-- deputate/           # Deputatsuebersicht
|   |   +-- stellensoll/        # Stellensoll berechnen
|   |   +-- stellenist/         # Stellenist berechnen
|   |   +-- vergleich/          # Soll-Ist-Vergleich
|   |   +-- zuschlaege/         # Zuschlaege verwalten
|   |   +-- mehrarbeit/         # Mehrarbeit erfassen
|   |   +-- historie/           # Berechnungshistorie
|   |   +-- export/             # Reports exportieren
|   |   +-- einstellungen/      # Schuljahre, Haushaltsjahre, Schulen
|   |   +-- admin/benutzer/     # Benutzerverwaltung (Admin)
|   |   +-- profil/             # Eigenes Profil
|   |   +-- api/deputate/sync/  # n8n-Sync-Endpoint
|   +-- components/
|   |   +-- layout/             # AuthenticatedLayout, Sidebar, Header, etc.
|   |   +-- ui/                 # Button, Card, KPICard, StatusIndicator
|   +-- db/
|   |   +-- schema.ts           # Drizzle ORM Schema (17 Tabellen)
|   |   +-- seed.ts             # Seed-Daten (Schulen, SLR, Admin)
|   |   +-- index.ts            # DB-Verbindung
|   |   +-- migrations/         # SQL-Migrationen
|   +-- lib/
|   |   +-- auth/               # Authentifizierung (session, roles, permissions)
|   |   +-- berechnungen/       # Berechnungslogik (NRW-Recht)
|   |   +-- db/queries.ts       # Alle Datenbank-Queries (~710 Zeilen)
|   |   +-- validation.ts       # Zod-Schemas
|   |   +-- constants.ts        # Schulform-Config, Monate
|   |   +-- format.ts           # Deutsche Zahlenformatierung
|   |   +-- audit.ts            # Audit-Log Schreiber
|   +-- middleware.ts            # Route-Schutz
+-- tests/
|   +-- lib/berechnungen/       # 49 Unit-Tests
+-- Dockerfile                  # Multi-Stage Docker Build
+-- docker-compose.yml          # Lokale Entwicklungs-DB
+-- docker-compose.prod.yml     # Production Deployment
+-- Caddyfile                   # Reverse Proxy
+-- .env.example                # Umgebungsvariablen-Vorlage
```

---

## 2. Architektur

### 2.1 Pattern: Server Components + Client Components + Server Actions

```
Browser
  |
  v
[Next.js Middleware] --> Prueft Session, leitet um bei fehlender Auth
  |
  v
[Server Component (page.tsx)] --> Laedt Daten serverseitig
  |
  v
[Client Component (*Client.tsx)] --> Interaktive UI, Formulare
  |
  v
[Server Action (actions.ts)] --> Validierung, DB-Operationen, Audit
  |
  v
[Queries (queries.ts)] --> Drizzle ORM SQL
  |
  v
[PostgreSQL]
```

**Jede Seite besteht aus 3 Dateien:**
1. `page.tsx` - Server Component: Laedt Daten, prueft Berechtigungen
2. `*Client.tsx` - Client Component: Interaktive UI mit useState/useRouter
3. `actions.ts` - Server Actions: "use server", Validierung, DB-Mutation

### 2.2 Authentifizierung

**Technologie:** iron-session v8 (verschluesselte Cookie-Sessions)

```
Cookie: "stellenist-session" (httpOnly, sameSite: lax)
Max-Age: 8 Stunden (ein Arbeitstag)
Verschluesselung: AES-256-GCM via SESSION_SECRET (min. 32 Zeichen)
```

**Session-Daten:**
```typescript
interface SessionData {
  benutzerId: number;
  email: string;
  name: string;
  rolle: "admin" | "mitarbeiter" | "betrachter";
  isLoggedIn: boolean;
}
```

### 2.3 Rollen-Hierarchie

| Rolle | Level | Darf |
|-------|-------|------|
| admin | 3 | Alles + Benutzerverwaltung + Einstellungen (Anlegen) |
| mitarbeiter | 2 | Daten bearbeiten, Berechnungen ausfuehren |
| betrachter | 1 | Nur lesen (alle Seiten sichtbar, keine Buttons) |

**Schutz-Funktionen (permissions.ts):**
- `requireAuth()` → Redirect zu /login wenn nicht eingeloggt
- `requireWriteAccess()` → Mindestens "mitarbeiter"
- `requireAdmin()` → Nur "admin"
- `getOptionalSession()` → Session oder null (fuer Layout)

### 2.4 Middleware

| Route | Schutz |
|-------|--------|
| `/login` | Oeffentlich |
| `/api/deputate/sync` | API-Key (fuer n8n) |
| `/admin/*` | Admin-Rolle erforderlich |
| Alle anderen | Session erforderlich |

### 2.5 Sicherheit

- **Rate-Limiting:** 5 Login-Versuche pro E-Mail in 15 Minuten (In-Memory)
- **Passwort:** bcryptjs, 12 Salt Rounds, min. 8 Zeichen
- **Session-Secret:** Min. 32 Zeichen, Startup-Check
- **API-Key:** Timing-safe Vergleich (verhindert Timing-Attacken)
- **Security-Headers (next.config.ts):**
  - `Content-Security-Policy`: self + unsafe-inline
  - `Strict-Transport-Security`: max-age 1 Jahr
  - `X-Frame-Options`: DENY
  - `X-Content-Type-Options`: nosniff
  - `Referrer-Policy`: strict-origin-when-cross-origin
- **Caddy:** Entfernt Server-Header, X-Robots-Tag: noindex

---

## 3. Datenbankschema (17 Tabellen)

### 3.1 Kern-Tabellen

#### `schulen` - Schulstammdaten
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schulnummer | VARCHAR(10) UNIQUE NOT NULL | NRW-Schulnummer |
| name | VARCHAR(200) NOT NULL | Voller Name |
| kurzname | VARCHAR(10) NOT NULL | z.B. GES, GYM, BK |
| untis_code | VARCHAR(10) | Untis OwnSchool Code |
| schulform | VARCHAR(50) NOT NULL | z.B. Gesamtschule |
| adresse | VARCHAR(300) | |
| plz | VARCHAR(5) | |
| ort | VARCHAR(100) | |
| farbe | VARCHAR(7) DEFAULT '#575756' | CREDO CI Farbe |
| ist_im_aufbau | BOOLEAN DEFAULT false | Sonderregel Aufbauschule |
| aktiv | BOOLEAN DEFAULT true | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `schul_stufen` - Stufen pro Schule
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id | INTEGER FK → schulen | |
| stufe | VARCHAR(50) NOT NULL | z.B. "Sek I", "Sek II" |
| schulform_typ | VARCHAR(50) NOT NULL | z.B. "Gesamtschule Sek I" |
| aktiv | BOOLEAN DEFAULT true | |
| UNIQUE | (schule_id, stufe) | |

#### `schuljahre` - Schuljahre
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| bezeichnung | VARCHAR(20) UNIQUE NOT NULL | z.B. "2025/2026" |
| start_datum | DATE NOT NULL | z.B. 2025-08-01 |
| end_datum | DATE NOT NULL | z.B. 2026-07-31 |
| untis_schoolyear_id | INTEGER UNIQUE | Untis-Referenz |
| aktiv | BOOLEAN DEFAULT true | Nur EINS aktiv |

#### `haushaltsjahre` - Haushaltsjahre (Kalenderjahre)
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| jahr | INTEGER UNIQUE NOT NULL | z.B. 2026 |
| stichtag_vorjahr | DATE | 15.10. des Vorjahres |
| stichtag_laufend | DATE | 15.10. des laufenden Jahres |
| gesperrt | BOOLEAN DEFAULT false | Keine Aenderungen mehr |

### 3.2 Schuelerzahlen & SLR

#### `schuelerzahlen` - Schuelerzahlen je Schule/Stufe/Stichtag
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id | INTEGER FK | |
| schul_stufe_id | INTEGER FK | |
| stichtag | DATE NOT NULL | Immer 15.10. |
| anzahl | INTEGER NOT NULL (>= 0) | Schuelerzahl |
| bemerkung | TEXT | |
| erfasst_von | VARCHAR(100) | |
| UNIQUE | (schule_id, schul_stufe_id, stichtag) | |
| INDEX | stichtag, schule_id | |

#### `slr_werte` - Schueler-Lehrer-Relation
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schuljahr_id | INTEGER FK | |
| schulform_typ | VARCHAR(50) NOT NULL | z.B. "Gesamtschule Sek I" |
| relation | NUMERIC(6,2) NOT NULL | z.B. 18.63 |
| quelle | VARCHAR(200) | Gesetzesreferenz |
| UNIQUE | (schuljahr_id, schulform_typ) | |

**SLR-Werte 2025/2026:**
| Schulform | Schueler je Stelle |
|-----------|-------------------|
| Grundschule | 21,95 |
| Hauptschule | 17,86 |
| Realschule | 20,19 |
| Sekundarschule | 16,27 |
| Gymnasium Sek I (G9) | 19,87 |
| Gymnasium Sek II | 12,70 |
| Gesamtschule Sek I | 18,63 |
| Gesamtschule Sek II | 12,70 |

### 3.3 Zuschlaege

#### `zuschlag_arten` - Zuschlagsarten (Stammdaten)
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| bezeichnung | VARCHAR(100) UNIQUE NOT NULL | |
| beschreibung | TEXT | |
| ist_standard | BOOLEAN DEFAULT false | |
| sortierung | INTEGER DEFAULT 0 | |

**Standard-Zuschlagsarten:**
1. Leitungszeit (Schulleitung)
2. Integration / Inklusion
3. KAoA (Kein Abschluss ohne Anschluss)
4. Digitalisierungsbeauftragter
5. Teilnahme an Schulleiterqualifikation
6. Ganztagszuschlag
7. Unterrichtsmehrbedarf
8. Ausgleichsbedarf

#### `zuschlaege` - Zuschlagswerte pro Schule/Haushaltsjahr
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id | INTEGER FK | |
| haushaltsjahr_id | INTEGER FK | |
| zuschlag_art_id | INTEGER FK | |
| wert | NUMERIC(8,4) NOT NULL | z.B. 0.2400 |
| zeitraum | VARCHAR(10) DEFAULT 'ganzjahr' | ganzjahr/jan-jul/aug-dez |
| bemerkung | TEXT | |
| UNIQUE | (schule_id, haushaltsjahr_id, zuschlag_art_id, zeitraum) | |

### 3.4 Lehrer & Deputate (aus Untis via n8n)

#### `lehrer` - Lehrerstammdaten
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| untis_teacher_id | INTEGER UNIQUE NOT NULL | Untis TEACHER_ID |
| personalnummer | VARCHAR(20) | |
| name | VARCHAR(50) NOT NULL | Kuerzel (z.B. "Mue") |
| vollname | VARCHAR(200) NOT NULL | |
| stammschule_id | INTEGER FK → schulen | |
| stammschule_code | VARCHAR(10) | z.B. "GES" |
| aktiv | BOOLEAN DEFAULT true | |
| INDEX | stammschule_id | |

#### `deputat_monatlich` - Monatliche Wochenstunden
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| lehrer_id | INTEGER FK | |
| haushaltsjahr_id | INTEGER FK | |
| monat | INTEGER (1-12) | |
| deputat_gesamt | NUMERIC(8,3) | Gesamt-Wochenstunden |
| deputat_ges | NUMERIC(8,3) DEFAULT 0 | davon GES |
| deputat_gym | NUMERIC(8,3) DEFAULT 0 | davon GYM |
| deputat_bk | NUMERIC(8,3) DEFAULT 0 | davon BK |
| quelle | VARCHAR(20) DEFAULT 'untis' | |
| sync_datum | TIMESTAMPTZ | |
| UNIQUE | (lehrer_id, haushaltsjahr_id, monat) | |

#### `mehrarbeit` - Mehrarbeitsstunden
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| lehrer_id | INTEGER FK | |
| haushaltsjahr_id | INTEGER FK | |
| monat | INTEGER (1-12) | |
| stunden | NUMERIC(8,2) DEFAULT 0 | |
| schule_id | INTEGER FK | Welcher Schule zugeordnet |
| bemerkung | TEXT | |
| UNIQUE | (lehrer_id, haushaltsjahr_id, monat, schule_id) | |

#### `deputat_sync_log` - n8n Sync-Protokoll
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| sync_datum | TIMESTAMPTZ DEFAULT NOW() | |
| schuljahr_text | VARCHAR(20) | z.B. "2025/2026" |
| term_id | INTEGER | Untis Term |
| anzahl_lehrer | INTEGER | |
| anzahl_aenderungen | INTEGER | |
| status | VARCHAR(20) DEFAULT 'success' | |
| fehler_details | TEXT | |
| rohdaten | JSONB | Kompletter Sync-Payload |

### 3.5 Berechnungsergebnisse

#### `berechnung_stellensoll` - Soll-Berechnungen
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id, haushaltsjahr_id | INTEGER FK | |
| zeitraum | VARCHAR(10) | "jan-jul" oder "aug-dez" |
| grundstellen_details | JSONB NOT NULL | Aufschluesslung pro Stufe |
| grundstellen_summe | NUMERIC(8,2) | Summe truncated |
| grundstellen_gerundet | NUMERIC(8,1) | Kaufmaennisch gerundet |
| zuschlaege_summe | NUMERIC(8,4) DEFAULT 0 | |
| zuschlaege_details | JSONB | Details pro Zuschlag |
| stellensoll | NUMERIC(8,1) NOT NULL | Endergebnis |
| berechnet_am | TIMESTAMPTZ | |
| berechnet_von | VARCHAR(100) | Benutzername |
| ist_aktuell | BOOLEAN DEFAULT true | |
| INDEX | (schule_id, haushaltsjahr_id) WHERE ist_aktuell=true |

#### `berechnung_stellenist` - Ist-Berechnungen
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id, haushaltsjahr_id | INTEGER FK | |
| zeitraum | VARCHAR(10) | |
| monats_durchschnitt_stunden | NUMERIC(10,4) | |
| regelstundendeputat | NUMERIC(6,2) | z.B. 25.50 |
| stellenist | NUMERIC(8,4) | Roh-Ergebnis |
| stellenist_gerundet | NUMERIC(8,1) | Gerundet |
| mehrarbeit_stellen | NUMERIC(8,4) DEFAULT 0 | |
| stellenist_gesamt | NUMERIC(8,1) NOT NULL | Ist + Mehrarbeit |
| details | JSONB | Monats-Aufschluesslung |
| ist_aktuell | BOOLEAN DEFAULT true | |
| INDEX | (schule_id, haushaltsjahr_id) WHERE ist_aktuell=true |

#### `berechnung_vergleich` - Soll-Ist-Vergleich
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| schule_id, haushaltsjahr_id | INTEGER FK | |
| stellensoll_id, stellenist_id | INTEGER FK | |
| stellensoll | NUMERIC(8,1) | Gewichteter Jahresdurchschnitt |
| stellenist | NUMERIC(8,1) | Gewichteter Jahresdurchschnitt |
| differenz | NUMERIC(8,1) | Soll - Ist |
| status | VARCHAR(20) | "im_soll" / "grenzbereich" / "ueber_soll" |
| refinanzierung | NUMERIC(8,1) | |

### 3.6 System-Tabellen

#### `audit_log` - Aenderungsprotokoll
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| tabelle | VARCHAR(50) NOT NULL | z.B. "schuelerzahlen" |
| datensatz_id | INTEGER NOT NULL | |
| aktion | VARCHAR(20) NOT NULL | INSERT/UPDATE/DELETE |
| alte_werte | JSONB | Vorher-Zustand |
| neue_werte | JSONB | Nachher-Zustand |
| benutzer | VARCHAR(100) | |
| zeitpunkt | TIMESTAMPTZ DEFAULT NOW() | |
| INDEX | (tabelle, datensatz_id) | |

#### `benutzer` - Anwendungsbenutzer
| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| id | SERIAL PK | |
| email | VARCHAR(200) UNIQUE NOT NULL | |
| passwort_hash | VARCHAR(200) NOT NULL | bcryptjs Hash |
| name | VARCHAR(200) NOT NULL | |
| rolle | VARCHAR(20) DEFAULT 'betrachter' | admin/mitarbeiter/betrachter |
| aktiv | BOOLEAN DEFAULT true | |
| letzter_login | TIMESTAMPTZ | |

---

## 4. Berechnungslogik (NRW-Recht)

### 4.1 Gesetzliche Grundlage
- § 3 FESchVO (NRW Foerdererschulen-Verordnung)
- VV zu § 3 FESchVO (Verwaltungsvorschrift)
- VO zu § 93 Abs. 2 SchulG (SLR-Verordnung)

### 4.2 Stichtag-Logik

**Stichtag:** 15. Oktober (amtliche Schulstatistik NRW)

| Zeitraum im Haushaltsjahr | Massgebliche Schuelerzahl |
|--------------------------|--------------------------|
| Januar - Juli (7 Monate) | Schuelerzahl vom 15.10. des **Vorjahres** |
| August - Dezember (5 Monate) | Schuelerzahl vom 15.10. des **laufenden Jahres** |

**Sonderfall:** Schulen im Aufbau (`ist_im_aufbau = true`) verwenden immer die Schuelerzahl des laufenden Jahres.

**Implementierung:** `src/lib/berechnungen/schuelerzahlen.ts`
- `getStichtagFuerMonat(haushaltsjahr, monat, istImAufbau)` → Date
- `getZeitraumFuerMonat(monat)` → "jan_jul" | "aug_dez"
- `getMonateImZeitraum(zeitraum)` → 7 oder 5

### 4.3 Grundstellenberechnung

**Formel:** `Grundstellen = Schuelerzahl / SLR`

**KRITISCHE Rundungsregeln:**

```
Schritt 1: Pro Stufe: Schueler / SLR = Rohergebnis
Schritt 2: Rohergebnis ABSCHNEIDEN auf 2 Dezimalstellen (NICHT runden!)
Schritt 3: Alle abgeschnittenen Teilergebnisse addieren
Schritt 4: Summe kaufmaennisch RUNDEN auf 1 Dezimalstelle
```

**Beispiel Gymnasium:**
```
Sek I:  600 / 19.87 = 30.1961... → ABSCHNEIDEN → 30.19
Sek II: 200 / 12.70 = 15.7480... → ABSCHNEIDEN → 15.74
Summe:  30.19 + 15.74 = 45.93   → RUNDEN      → 45.9 Stellen
```

**Implementierung:** `src/lib/berechnungen/grundstellen.ts`
- `berechneGrundstellen(stufen[])` → GrundstellenErgebnis

**Rundungsfunktionen:** `src/lib/berechnungen/rounding.ts`
- `truncateToDecimals(value, decimals)` → String-basiert (Floating-Point sicher)
- `roundToDecimals(value, decimals)` → Kaufmaennisch

### 4.4 Stellensoll

**Formel:** `Stellensoll = Grundstellen (gerundet) + Zuschlaege`

**Zuschlaege-Zeitraum-Logik:**
- `ganzjahr` → Gilt fuer beide Zeitraeume (Jan-Jul UND Aug-Dez)
- `jan-jul` → Gilt nur fuer Januar bis Juli
- `aug-dez` → Gilt nur fuer August bis Dezember

**Implementierung:** `src/lib/berechnungen/stellensoll.ts`
- `berechneStellensoll(input)` → StellensollErgebnis

### 4.5 Stellenist

**Formel:**
```
Stellenist = Summe(Wochenstunden im Zeitraum) / (Monate × Regeldeputat)
+ Mehrarbeit-Stellen
= Stellenist gesamt (gerundet auf 1 Dezimalstelle)
```

**Regeldeputat:** 25,5 Wochenstunden (fuer GES, GYM, BK)

**Implementierung:** `src/lib/berechnungen/stellenist.ts`
- `berechneStellenist(input)` → StellenistErgebnis (mit Jan-Jul + Aug-Dez + Gewichtung)

### 4.6 Gewichteter Jahresdurchschnitt

**Formel:** `(Jan-Jul-Wert × 7 + Aug-Dez-Wert × 5) / 12`

Wenn nur ein Zeitraum vorliegt, wird dessen Wert direkt verwendet.

**Implementierung:** `src/lib/berechnungen/vergleich.ts`
- `berechneGewichtetenDurchschnitt(janJulWert, augDezWert)` → number
- `aktualisiereVergleich(schuleId, haushaltsjahrId)` → DB Update

### 4.7 Soll-Ist-Vergleich

| Situation | Status | Bedeutung |
|-----------|--------|-----------|
| Stellenist <= Stellensoll | im_soll | Land erstattet tatsaechliche Personalkosten |
| Stellenist nahe Stellensoll | grenzbereich | Achtung: knapp |
| Stellenist > Stellensoll | ueber_soll | Land zahlt nur bis Stellensoll, Rest traegt Schultraeger |

---

## 5. Seitenstruktur (16 Seiten)

### 5.1 Oeffentliche Seiten

| Route | Seite | Beschreibung |
|-------|-------|-------------|
| `/` | Root | Redirect zu /dashboard |
| `/login` | Login | E-Mail + Passwort, CREDO-Branding |

### 5.2 Geschuetzte Seiten (requireAuth)

| Route | Seite | Datenquellen | Features |
|-------|-------|-------------|----------|
| `/dashboard` | Dashboard | schulen, vergleiche, sync | KPI-Cards pro Schule (Soll/Ist/Differenz/Lehrer) |
| `/schuelerzahlen` | Schuelerzahlen | schulen, stufen, schuelerzahlen | Tabelle + Inline-Formular, Stichtag-Anzeige |
| `/slr-konfiguration` | SLR-Werte | schuljahre, slrWerte | Schuljahr-Dropdown, Werte-Tabelle |
| `/deputate` | Deputate | lehrer, deputatMonatlich, sync | 12-Monats-Grid, Schul-Filter, Summen |
| `/stellensoll` | Stellensoll | berechnungStellensoll | Berechnung ausfuehren, Aufschluesslung pro Stufe |
| `/stellenist` | Stellenist | berechnungStellenist, deputate | Berechnung ausfuehren, Zeitraum-KPIs |
| `/vergleich` | Soll-Ist | berechnungVergleich | Gesamt-KPIs, Ampel pro Schule, Refinanzierung |
| `/zuschlaege` | Zuschlaege | zuschlagArten, zuschlaege | Formular pro Schule/Haushaltsjahr |
| `/mehrarbeit` | Mehrarbeit | lehrer, mehrarbeit | Formular, Lehrer-Dropdown, Monat/Stunden |
| `/historie` | Historie | sollRows, istRows, syncRows | Chronologische Tabelle, farbcodiert |
| `/export` | Export | - | 4 Export-Optionen (Platzhalter, Phase 6) |
| `/einstellungen` | Einstellungen | schulen, schuljahre, haushaltsjahre, sync | Schuljahre/HJ anlegen (Admin), Schulen-Tabelle |
| `/profil` | Profil | session, benutzer | Profilanzeige, Passwort aendern |

### 5.3 Admin-Seiten (requireAdmin)

| Route | Seite | Features |
|-------|-------|----------|
| `/admin/benutzer` | Benutzerverwaltung | Anlegen, Bearbeiten, Passwort zuruecksetzen, Aktivieren/Deaktivieren |

### 5.4 API-Endpunkte

| Route | Methode | Auth | Beschreibung |
|-------|---------|------|-------------|
| `/api/deputate/sync` | POST | API-Key | n8n-Sync (Lehrer + Deputate aus Untis) |

---

## 6. Server Actions (9 Dateien)

### 6.1 Login (`src/app/login/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `loginAction(formData)` | Oeffentlich | E-Mail/Passwort pruefen, Session erstellen, Rate-Limiting |
| `logoutAction()` | Oeffentlich | Session zerstoeren |

**Rate-Limiting:** 5 Versuche pro E-Mail in 15 Minuten (In-Memory Map)

### 6.2 Schuelerzahlen (`src/app/schuelerzahlen/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `saveSchuelerzahl(formData)` | requireWriteAccess | Schuelerzahl upserten |
| `removeSchuelerzahl(formData)` | requireWriteAccess | Schuelerzahl loeschen |

### 6.3 Stellensoll (`src/app/stellensoll/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `berechneStellensollAction()` | requireWriteAccess | Fuer alle Schulen berechnen (beide Zeitraeume) |

**Ablauf:**
1. Aktuelles Haushaltsjahr + Schuljahr laden
2. Pro Schule: Stufen + Schuelerzahlen + SLR + Zuschlaege laden
3. Zuschlaege nach Zeitraum filtern (`ganzjahr` gilt immer)
4. Grundstellen berechnen (truncate + round)
5. Alte Berechnung deaktivieren, neue speichern (Transaktion)
6. Vergleich aktualisieren

### 6.4 Stellenist (`src/app/stellenist/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `berechneStellenisteAction()` | requireWriteAccess | Fuer alle Schulen berechnen |

**Ablauf:**
1. Aktuelles Haushaltsjahr laden
2. Pro Schule: Deputat-Summen + Mehrarbeit laden
3. `berechneStellenist()` aus lib aufrufen
4. Ergebnis pro Zeitraum in DB speichern
5. Vergleich aktualisieren

### 6.5 Zuschlaege (`src/app/zuschlaege/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `saveZuschlaege(formData)` | requireWriteAccess | Zuschlaege pro Schule/HJ upserten |

### 6.6 Mehrarbeit (`src/app/mehrarbeit/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `saveMehrarbeit(formData)` | requireWriteAccess | Mehrarbeit-Eintrag upserten |
| `removeMehrarbeit(formData)` | requireWriteAccess | Mehrarbeit-Eintrag loeschen |

### 6.7 Einstellungen (`src/app/einstellungen/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `createSchuljahrAction(formData)` | requireAdmin | Neues Schuljahr anlegen |
| `toggleSchuljahrAktivAction(formData)` | requireAdmin | Aktives Schuljahr setzen (nur EINS) |
| `createHaushaltsjahrAction(formData)` | requireAdmin | Neues Haushaltsjahr anlegen |
| `toggleHaushaltsjahrGesperrtAction(formData)` | requireAdmin | Sperren/Entsperren |

### 6.8 Benutzerverwaltung (`src/app/admin/benutzer/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `createBenutzerAction(formData)` | requireAdmin | Benutzer anlegen |
| `updateBenutzerAction(formData)` | requireAdmin | Name/E-Mail/Rolle aendern |
| `toggleBenutzerAktivAction(formData)` | requireAdmin | Aktivieren/Deaktivieren |
| `resetPasswordAction(formData)` | requireAdmin | Passwort zuruecksetzen |

### 6.9 Profil (`src/app/profil/actions.ts`)

| Action | Guard | Beschreibung |
|--------|-------|-------------|
| `changePasswordAction(formData)` | requireAuth | Eigenes Passwort aendern |

---

## 7. n8n-Integration

### 7.1 Sync-Endpoint

**Route:** `POST /api/deputate/sync`
**Datei:** `src/app/api/deputate/sync/route.ts` (297 Zeilen)

**Request von n8n:**
```json
{
  "api_key": "...",
  "sync_datum": "2026-03-12",
  "schuljahr_text": "2025/2026",
  "term_id": 3,
  "date_from": "01.02.2026",
  "date_to": "30.06.2026",
  "lehrer": [
    {
      "teacher_id": 123,
      "name": "Mue",
      "personalnummer": "P001",
      "stammschule": "GES",
      "vollname": "Mueller Max",
      "deputat": 25.5,
      "deputat_ges": 20.0,
      "deputat_gym": 5.5,
      "deputat_bk": 0
    }
  ]
}
```

**Ablauf:**
1. API-Key validieren (Timing-safe)
2. Payload mit Zod validieren
3. Schul-Mapping laden (untis_code → schulen.id)
4. Haushaltsjahr bestimmen aus sync_datum
5. Monate aus date_from/date_to berechnen
6. Pro Lehrer: Upsert in `lehrer` + `deputat_monatlich`
7. Sync-Log schreiben
8. Response mit Statistiken zurueckgeben

**n8n Workflow #221:** Laeuft taeglich 8:00 Uhr, liest aus Untis MSSQL

---

## 8. Komponenten-Bibliothek

### 8.1 Layout-Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `AuthenticatedLayout` | layout/AuthenticatedLayout.tsx | Server Component, zeigt Sidebar nur wenn eingeloggt |
| `Sidebar` | layout/Sidebar.tsx | Fixe linke Navigation (280px), 11 Haupt-Items + Admin-Bereich |
| `Header` | layout/Header.tsx | Breadcrumbs + Titel + optionale Actions |
| `PageContainer` | layout/PageContainer.tsx | Inhaltsbereich (ml-280px, max-w-1200px) |
| `SchoolTabs` | layout/SchoolTabs.tsx | Schul-Tab-Leiste mit Farbcodierung |

### 8.2 UI-Komponenten

| Komponente | Datei | Varianten |
|-----------|-------|-----------|
| `Button` | ui/Button.tsx | primary, secondary, danger, ghost / sm, md, lg |
| `Card` | ui/Card.tsx | Standard-Card mit Rahmen |
| `KPICard` | ui/Card.tsx | Metrikkarte mit farbigem Rand + Status |
| `StatusIndicator` | ui/StatusIndicator.tsx | Ampel-Punkt: success/warning/danger/neutral |

### 8.3 CREDO Corporate Design

| Schule | Kurzname | Farbe | Hex |
|--------|----------|-------|-----|
| Gesamtschule | GES | Gruen | #6BAA24 |
| Gymnasium | GYM | Gelb | #FBC900 |
| Berufskolleg | BK | Blau | #5C82A5 |
| CREDO Verwaltung | - | Grau | #575756 |
| Akzent Rot | - | Rot | #E2001A |
| Akzent Blau | - | Blau | #009AC6 |

---

## 9. Datenbank-Queries

**Datei:** `src/lib/db/queries.ts` (~710 Zeilen)
**30+ exportierte Funktionen**, gegliedert nach Bereich:

### Schulen
- `getSchulen()` - Alle aktiven, sortiert nach Kurzname
- `getSchuleById(id)`, `getSchuleByKurzname(kurzname)`

### Schuljahre & Haushaltsjahre
- `getSchuljahre()`, `getAktuellesSchuljahr()`
- `createSchuljahr(data)`, `updateSchuljahrAktiv(id, aktiv)`
- `getHaushaltsjahre()`, `getHaushaltsjahrByJahr(jahr)`, `getAktuellesHaushaltsjahr()`
- `createHaushaltsjahr(data)`, `updateHaushaltsjahrGesperrt(id, gesperrt)`

### Schuelerzahlen & SLR
- `getSchuelerzahlenBySchule(schuleId)`, `getSchuelerzahlenByStichtag(schuleId, stichtag)`
- `upsertSchuelerzahl(data)`, `deleteSchuelerzahl(id)`
- `getSlrWerteBySchuljahr(schuljahrId)`, `getSlrWert(schuljahrId, schulformTyp)`
- `upsertSlrWert(data)`

### Zuschlaege
- `getZuschlagArten()`, `getZuschlaegeBySchuleUndHaushaltsjahr(schuleId, hjId)`
- `upsertZuschlag(data)`

### Deputate & Lehrer
- `getLehrerMitDeputaten(hjId, schuleId?)`, `getDeputatSummenByMonat(hjId, schuleId?)`
- `getAktiveLehrer()`

### Berechnungsergebnisse
- `getAktuelleStellensollBySchule(schuleId, hjId)`, `getAktuelleStellensollAlleSchulen(hjId)`
- `getAktuelleStellenisteBySchule(schuleId, hjId)`, `getAktuelleStellenisteAlleSchulen(hjId)`
- `getAktuelleVergleiche(hjId)`

### Mehrarbeit
- `getMehrarbeitByHaushaltsjahr(hjId, schuleId?)`, `upsertMehrarbeit(data)`, `deleteMehrarbeit(id)`

### Benutzer
- `getAllBenutzer()`, `getBenutzerById(id)`, `getBenutzerByEmail(email)`
- `createBenutzer(data)`, `updateBenutzer(id, data)`, `updateBenutzerPasswort(id, hash)`

### Historie & Sync
- `getBerechnungsHistorie(limit)`, `getLatestSync()`

---

## 10. Validierung (Zod-Schemas)

**Datei:** `src/lib/validation.ts`

| Schema | Felder | Verwendung |
|--------|--------|-----------|
| `loginSchema` | email, passwort (min 1) | Login |
| `createBenutzerSchema` | email, name, rolle, passwort (min 8) | Benutzer anlegen |
| `updateBenutzerSchema` | id, name, email, rolle | Benutzer bearbeiten |
| `changePasswordSchema` | aktuellesPasswort, neuesPasswort (min 8), bestaetigung | Profil |
| `resetPasswordSchema` | id, neuesPasswort (min 8) | Admin-Reset |
| `schuelerzahlSchema` | schuleId, schulStufeId, stichtag, anzahl (>= 0), bemerkung? | Schuelerzahlen |
| `zuschlagWertSchema` | wert (Dezimalzahl mit Komma-Support) | Zuschlaege |
| `mehrarbeitSchema` | lehrerId, haushaltsjahrId, monat (1-12), stunden (>= 0), schuleId?, bemerkung? | Mehrarbeit |
| `schuljahrSchema` | bezeichnung (JJJJ/JJJJ), startDatum, endDatum | Einstellungen |
| `haushaltsjahrSchema` | jahr (2020-2050), stichtagVorjahr, stichtagLaufend | Einstellungen |
| `lehrerPayloadSchema` | teacher_id, name, stammschule, vollname, deputat, deputat_ges/gym/bk | n8n-Sync |
| `syncPayloadSchema` | api_key, sync_datum, schuljahr_text, term_id?, date_from/to, lehrer[] | n8n-Sync |

**Hilfsfunktionen:**
- `safeFormNumber(formData, key)` - Sichere Zahl-Extraktion
- `safeFormString(formData, key, maxLength)` - Sichere String-Extraktion (begrenzt Laenge)

---

## 11. Tests

**Datei:** `tests/lib/berechnungen/` (5 Dateien, 49 Tests)
**Runner:** Vitest 4.0.18

| Testdatei | Tests | Beschreibung |
|-----------|-------|-------------|
| `grundstellen.test.ts` | ~12 | Truncate vs. Round, Multi-Stufen, Edge Cases |
| `rounding.test.ts` | ~15 | truncateToDecimals, roundToDecimals, roundToTen |
| `schuelerzahlen.test.ts` | ~10 | Stichtag-Logik, Zeitraum-Zuordnung, Aufbauschule |
| `stellenist.test.ts` | ~8 | Deputat-Berechnung, Mehrarbeit, Gewichtung |
| `stellensoll.test.ts` | ~4 | Grundstellen + Zuschlaege, Endergebnis |

**Befehle:**
```bash
npm run test        # Einmalig
npm run test:watch  # Dauerhaft
```

---

## 12. Deployment

### 12.1 Lokale Entwicklung

```bash
# 1. PostgreSQL starten (Docker)
docker compose up -d

# 2. Dependencies installieren
npm install

# 3. .env anlegen (siehe .env.example)
cp .env.example .env

# 4. Schema pushen
npm run db:push

# 5. Seed-Daten laden
npm run db:seed

# 6. Dev-Server starten
npm run dev
```

### 12.2 Production (Docker)

**Dockerfile:** Multi-Stage Build (3 Stages)
1. `deps` - npm ci (Dependencies)
2. `builder` - npm run build (Next.js standalone)
3. `runner` - Minimales Image, non-root User (nextjs:1001)

**docker-compose.prod.yml:**
```
Services:
  db: postgres:16-alpine (Health-Check)
  app: Next.js Standalone (Port 3000)

Netzwerke:
  reverse_proxy (extern, fuer Caddy)
  internal (nur DB ↔ App)
```

**Caddyfile:** `stellenist.fes-credo.de` → `app:3000`

**Starten:**
```bash
# .env anlegen mit:
# DB_PASSWORD=<sicheres-passwort>
# SESSION_SECRET=<min-32-zeichen>
# API_SYNC_KEY=<sync-key>

docker compose -f docker-compose.prod.yml up -d --build
```

### 12.3 Umgebungsvariablen

| Variable | Beschreibung | Beispiel |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL Connection String | postgresql://stellenist:pw@db:5432/stellenistberechnung |
| `DB_PASSWORD` | Nur docker-compose.prod.yml | (sicheres Passwort) |
| `SESSION_SECRET` | Cookie-Verschluesselung (min. 32 Zeichen) | `openssl rand -base64 48` |
| `API_SYNC_KEY` | n8n Sync-Authentifizierung | (beliebiger sicherer Key) |

---

## 13. Seed-Daten

**Datei:** `src/db/seed.ts`
**Aufruf:** `npm run db:seed`

### Erzeugte Daten:

**3 Schulen:**
| Kurzname | Name | Schulform | Farbe |
|----------|------|-----------|-------|
| GES | Freie Evangelische Gesamtschule Minden | Gesamtschule | #6BAA24 |
| GYM | Freie Evangelisches Gymnasium Minden | Gymnasium | #FBC900 |
| BK | Freie Evangelisches Berufskolleg Minden | Berufskolleg | #5C82A5 |

**Stufen pro Schule:**
- GES: Sek I (Gesamtschule Sek I), Sek II (Gesamtschule Sek II)
- GYM: Sek I (Gymnasium Sek I (G9)), Sek II (Gymnasium Sek II)
- BK: Vollzeit (Berufskolleg Vollzeit)

**3 Schuljahre:** 2023/2024, 2024/2025, 2025/2026 (aktiv)

**3 Haushaltsjahre:** 2024, 2025, 2026 (mit Stichtagen 15.10.)

**8 Zuschlagsarten** (s. Abschnitt 3.3)

**4 Beispiel-Schuelerzahlen:**
- GES Sek I: 530 (15.10.2023), 569 (15.10.2024)
- GYM Sek I: 457 (15.10.2023), 455 (15.10.2024)

**Admin-Benutzer:** admin@fes-credo.de, Rolle: admin

---

## 14. Offene Punkte / Roadmap

### 14.1 Fehlende Features

| Feature | Prioritaet | Beschreibung |
|---------|-----------|-------------|
| **Schulen-CRUD** | HOCH | Schulen anlegen/bearbeiten/Schulnummer aendern in Einstellungen |
| **Export (PDF/Excel)** | HOCH | Reports fuer Bezirksregierung (Anlage 2a, Deputats- und Schuelerzahlen-Uebersicht, Berechnungsnachweis) |
| **Schul-Stufen Verwaltung** | MITTEL | Stufen pro Schule in UI pflegen (aktuell nur via Seed) |
| **Deputate-Einzelansicht** | MITTEL | /deputate/[lehrerId] Detail-Seite |
| **Befoerderungsstellen** | NIEDRIG | 3-Jahres-Phasenverschiebung (§ 4.5 Projektplan) |
| **TV-L Pauschalen** | NIEDRIG | Kostenberechnung EG 13/EG 11 (§ 4.6 Projektplan) |
| **E2E-Tests** | NIEDRIG | Playwright Browser-Tests |

### 14.2 Bekannte technische Punkte

| Punkt | Status |
|-------|--------|
| DB-Migrationen (drizzle-kit generate) | Noch nicht erzeugt, aktuell via db:push |
| PDF-Export Library (@react-pdf/renderer) | In package.json geplant, noch nicht installiert |
| Excel-Export Library (exceljs) | In package.json geplant, noch nicht installiert |
| Grundschulen (GSH, GSM, GSS) | Schema bereit, noch nicht in Seed |
| Regeldeputat pro Schulform | Aktuell hardcoded 25.5 in stellenist/actions.ts |

---

## 15. Datei-Uebersicht (alle Quelldateien)

### src/app/ (Seiten + Actions)

| Datei | Zeilen | Typ |
|-------|--------|-----|
| page.tsx | 6 | Redirect |
| layout.tsx | 30 | Root Layout |
| globals.css | 61 | Styles |
| middleware.ts | 49 | Route-Schutz |
| login/page.tsx | 64 | Server Component |
| login/LoginForm.tsx | 92 | Client Component |
| login/actions.ts | 125 | Server Actions |
| dashboard/page.tsx | 152 | Server Component |
| schuelerzahlen/page.tsx | 72 | Server Component |
| schuelerzahlen/SchuelerzahlenClient.tsx | 283 | Client Component |
| schuelerzahlen/actions.ts | 67 | Server Actions |
| slr-konfiguration/page.tsx | 74 | Server Component |
| slr-konfiguration/SlrClient.tsx | 85 | Client Component |
| deputate/page.tsx | 135 | Server Component |
| deputate/DeputateClient.tsx | 197 | Client Component |
| stellensoll/page.tsx | 87 | Server Component |
| stellensoll/StellensollClient.tsx | 286 | Client Component |
| stellensoll/actions.ts | 184 | Server Actions |
| stellenist/page.tsx | 121 | Server Component |
| stellenist/StellenistClient.tsx | 255 | Client Component |
| stellenist/actions.ts | 180 | Server Actions |
| vergleich/page.tsx | 163 | Server Component |
| zuschlaege/page.tsx | 74 | Server Component |
| zuschlaege/ZuschlaegeClient.tsx | 197 | Client Component |
| zuschlaege/actions.ts | 56 | Server Actions |
| mehrarbeit/page.tsx | 81 | Server Component |
| mehrarbeit/MehrarbeitClient.tsx | 306 | Client Component |
| mehrarbeit/actions.ts | 67 | Server Actions |
| historie/page.tsx | 183 | Server Component |
| export/page.tsx | 106 | Server Component |
| einstellungen/page.tsx | 110 | Server Component |
| einstellungen/EinstellungenClient.tsx | 541 | Client Component |
| einstellungen/actions.ts | 150 | Server Actions |
| admin/benutzer/page.tsx | 22 | Server Component |
| admin/benutzer/BenutzerVerwaltungClient.tsx | 478 | Client Component |
| admin/benutzer/actions.ts | 176 | Server Actions |
| profil/page.tsx | 24 | Server Component |
| profil/ProfilClient.tsx | 152 | Client Component |
| profil/actions.ts | 56 | Server Actions |
| api/deputate/sync/route.ts | 297 | API Route |

### src/components/ (UI-Bibliothek)

| Datei | Zeilen |
|-------|--------|
| layout/AuthenticatedLayout.tsx | 30 |
| layout/Sidebar.tsx | 231 |
| layout/Header.tsx | 52 |
| layout/PageContainer.tsx | 13 |
| layout/SchoolTabs.tsx | ~40 |
| ui/Button.tsx | 40 |
| ui/Card.tsx | 49 |
| ui/StatusIndicator.tsx | 36 |

### src/lib/ (Business Logic)

| Datei | Zeilen | Exports |
|-------|--------|---------|
| db/queries.ts | ~710 | 30+ Query-Funktionen |
| validation.ts | 182 | 10 Schemas + 2 Helpers |
| berechnungen/grundstellen.ts | 81 | berechneGrundstellen |
| berechnungen/rounding.ts | 60 | truncateToDecimals, roundToDecimals, roundToTen |
| berechnungen/schuelerzahlen.ts | 59 | getStichtagFuerMonat, getZeitraumFuerMonat, etc. |
| berechnungen/stellenist.ts | 108 | berechneStellenist |
| berechnungen/stellensoll.ts | 56 | berechneStellensoll |
| berechnungen/vergleich.ts | 119 | berechneGewichtetenDurchschnitt, aktualisiereVergleich |
| auth/roles.ts | 39 | Rolle, ROLE_LEVEL, getRolleLabel, getRolleBadgeColor |
| auth/session.ts | 60 | SessionData, getSession, sessionOptions |
| auth/auth.ts | 45 | hashPassword, verifyPassword, findBenutzerByEmail |
| auth/permissions.ts | 64 | requireAuth, requireRole, requireWriteAccess, requireAdmin |
| constants.ts | 73 | SCHULFORM_CONFIG, SLR_DEFAULTS_2025_2026, MONATE |
| format.ts | 37 | formatNumberDE, formatDateDE, formatStellen, formatDifferenz |
| audit.ts | 31 | writeAuditLog |

### src/db/ (Datenbank)

| Datei | Zeilen |
|-------|--------|
| schema.ts | 318 |
| seed.ts | 190 |
| index.ts | 10 |

### tests/ (Unit-Tests)

| Datei | Tests |
|-------|-------|
| lib/berechnungen/grundstellen.test.ts | ~12 |
| lib/berechnungen/rounding.test.ts | ~15 |
| lib/berechnungen/schuelerzahlen.test.ts | ~10 |
| lib/berechnungen/stellenist.test.ts | ~8 |
| lib/berechnungen/stellensoll.test.ts | ~4 |
| **Gesamt** | **49 Tests** |

### Root-Konfiguration

| Datei | Beschreibung |
|-------|-------------|
| package.json | Dependencies + Scripts |
| next.config.ts | Standalone Output + Security Headers |
| tsconfig.json | TypeScript Config |
| vitest.config.ts | Test Config |
| drizzle.config.ts | ORM Config |
| Dockerfile | Multi-Stage Build |
| docker-compose.yml | Lokale Dev-DB |
| docker-compose.prod.yml | Production Stack |
| Caddyfile | Reverse Proxy |
| .env.example | Umgebungsvariablen-Vorlage |
| .gitignore | Git-Ausschluesse |
| .dockerignore | Docker-Ausschluesse |

---

**Gesamtumfang:** ~83 Quelldateien, ~6.500+ Zeilen Anwendungscode, 49 Unit-Tests
