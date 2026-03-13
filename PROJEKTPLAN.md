# Stellenistberechnung Webanwendung - Projektplan

## 1. Kontext & Ziel

Die CREDO/FES-Schulgruppe (Christlicher Schulverein Minden e.V.) betreibt mehrere Ersatzschulen in NRW. Fuer die Bezirksregierung muessen rechtssichere Stellenberechnungen erstellt werden. Aktuell laeuft das manuell ueber Excel-Tabellen.

**Ziel:** Eine Webanwendung, die:
- Deputatsdaten aus Untis (via n8n) automatisch einliest
- Schuelerzahlen verwaltet
- Stellensoll und Stellenist nach NRW-Recht berechnet
- Soll-Ist-Vergleiche mit Ampellogik anzeigt
- Reports fuer die Bezirksregierung exportiert

**Zielgruppe:** Personalabteilung, 40-60 Jahre alt. Klare, grosse UI, kein Fachjargon.

---

## 2. Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 14+ (App Router) |
| Sprache | TypeScript |
| CSS | Tailwind CSS |
| ORM | Drizzle ORM |
| Datenbank | PostgreSQL 15+ (eigene, separate Instanz) |
| Validierung | Zod |
| PDF-Export | @react-pdf/renderer |
| Excel-Export | exceljs |
| Tests | Vitest (Unit), Playwright (E2E) |
| Deployment | Docker / PM2 auf On-Premise Server |

---

## 3. Schulen & Schulformen

Jede Schule hat eine eigene **Schulnummer** (offiziell von NRW vergeben).

### Aktuell in Untis vorhanden:
| Kurzname | Schulform | CREDO-Farbe | Stufen | SLR 2025/2026 |
|----------|-----------|-------------|--------|----------------|
| GES | Freie Evangelische Gesamtschule Minden | #6BAA24 | Sek I, Sek II | Sek I: 18.63, Sek II: 12.70 |
| GYM | Freie Evangelisches Gymnasium Minden | #FBC900 | Sek I (G9), Sek II | Sek I: 19.87, Sek II: 12.70 |
| BK | Freie Evangelisches Berufskolleg Minden | #5C82A5 | eigene Stufe | abhaengig von Bildungsgang |

### Spaeter hinzukommend:
| Kurzname | Schulform | SLR 2025/2026 |
|----------|-----------|----------------|
| GSH | Grundschule Herford | 21.95 |
| GSM | Grundschule Minden | 21.95 |
| GSS | Grundschule Stemwede | 21.95 |

### Untis-Mapping:
- `OwnSchool` in Untis liefert Strings: `'GES'`, `'GYM'`, `'BK'`
- `PlannedPerDept` kodiert Deputate pro Schulform: `1~GES`, `2~GYM`, `3~BK`
- `PlannedWeek` = Gesamt-Deputat in Millisekunden (/ 1000 = Stunden)

---

## 4. Rechtliche Berechnungsregeln (NRW)

### 4.1 Schuelerzahlen-Logik

**Stichtag:** 15. Oktober (amtliche Schulstatistik)

| Zeitraum im Haushaltsjahr | Massgebliche Schuelerzahl |
|--------------------------|--------------------------|
| Januar - Juli (7 Monate) | Schuelerzahl vom 15.10. des **Vorjahres** |
| August - Dezember (5 Monate) | Schuelerzahl vom 15.10. des **laufenden Jahres** |

**Sonderfall:** Schulen im Aufbau verwenden im Startjahr nur die Schuelerzahl des laufenden Jahres.

**Gesetzliche Grundlage:** § 3 FESchVO, VV zu § 3 FESchVO

### 4.2 Schueler-Lehrer-Relation (SLR)

Wird jaehrlich per Verordnung (VO zu § 93 Abs. 2 SchulG) festgelegt.

**Aktuelle Werte Schuljahr 2025/2026:**

| Schulform | Schueler je Stelle |
|-----------|-------------------|
| Grundschule | 21,95 |
| Hauptschule | 17,86 |
| Realschule | 20,19 |
| Sekundarschule | 16,27 |
| Gymnasium - Sek I (G9) | 19,87 |
| Gymnasium - Sek II | 12,70 |
| Gesamtschule - Sek I | 18,63 |
| Gesamtschule - Sek II | 12,70 |

### 4.3 Grundstellenberechnung

**Formel:** `Grundstellenzahl = Schuelerzahl / SLR`

**KRITISCHE Rundungsregeln:**
1. Bei verschiedenen Stufen/Relationen: Jedes Teilergebnis nach **2 Dezimalstellen ABSCHNEIDEN** (NICHT runden!)
2. Alle Teilergebnisse addieren
3. Gesamtergebnis auf **1 Dezimalstelle RUNDEN** (kaufmaennisch)

**Implementierung:**
```typescript
// ABSCHNEIDEN (truncate) - NICHT Math.round!
function truncateToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.trunc(value * factor) / factor;
}

// Kaufmaennisches Runden
function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

**Rechenbeispiel Gymnasium:**
```
Sek I:  600 Schueler / 19.87 = 30.1961...  → abschneiden → 30.19
Sek II: 200 Schueler / 12.70 = 15.7480...  → abschneiden → 15.74
Summe:  30.19 + 15.74 = 45.93              → runden      → 45.9 Stellen
```

**Rechenbeispiel GES (aus Excel):**
```
Jan-Jul: 530 / 18.63 = 28.4487... → abschneiden → 28.44 → runden → 28.4
Aug-Dez: 569 / 18.63 = 30.5421... → abschneiden → 30.54 → runden → 30.5
```

### 4.4 Zuschlaege zum Grundstellenbedarf

| Zuschlag | Beschreibung | Typischer Wert |
|----------|-------------|----------------|
| Leitungszeit (Schulleitung) | Leitungszeit | 0.2 Stellen |
| Integration | Gemeinsames Lernen / Inklusion | variabel |
| KAoA | Kein Abschluss ohne Anschluss | 0.24 Stellen |
| Digitalisierungsbeauftragter | | 0.04 Stellen |
| Ganztagszuschlag | Nur bei Refinanzierungszusage | variabel |
| Unterrichtsmehrbedarf | Sonderpaed. Foerderung | gem. Bewirtschaftungserlass |
| Ausgleichsbedarf | | gem. Bewirtschaftungserlass |

**Wichtig:** Stellen nach § 106 Abs. 10 SchulG (Sonderbedarfe) bleiben bei Zuschlaegen AUSSEN VOR.

### 4.5 Befoerderungsstellen

**Phasenverschiebung (3 Jahre):**
- Neue Stellen durch steigende Schuelerzahlen erst nach 3 Jahren fuer Befoerderungsstellen
- Vergleich: Stellenzahl 15.10.(Jahr-1) vs. 15.10.(Jahr-3), NIEDRIGERE Zahl zaehlt

**Obergrenzen hoeherer Dienst:**
| Schulform | Max. Anteil |
|-----------|------------|
| Gesamtschule (Sek I+II) | 47% |
| Sekundarschule | 16.5% |

### 4.6 Pauschalen (TV-L-basiert)

| Schulform | Berechnungsgrundlage |
|-----------|---------------------|
| Gymnasium, BK | EG 13 Stufe 1 x 12 + 40% JSZ + 30% SV |
| Alle anderen | EG 11 Stufe 1 x 12 + 55% JSZ + 30% SV |

Ergebnis kaufmaennisch auf **volle 10 EUR** runden.

### 4.7 Stellenist

**Definition:** Summe der tatsaechlich besetzten Stellen (Vollzeit + anteilige Teilzeit)

**Berechnung aus Deputatsdaten:**
```
Stellenist Jan-Jul = Summe(Wochenstunden Jan-Jul) / (7 x Regeldeputat)
Stellenist Aug-Dez = Summe(Wochenstunden Aug-Dez) / (5 x Regeldeputat)
+ Mehrarbeit-Stellen
= Stellenist gesamt
```

### 4.8 Soll-Ist-Abgleich

| Situation | Konsequenz |
|-----------|-----------|
| Stellenist <= Stellensoll | Land erstattet tatsaechliche Personalkosten |
| Stellenist > Stellensoll | Land zahlt nur bis Stellensoll, Rest traegt Schultraeger |

### 4.9 Fristen

| Frist | Termin |
|-------|--------|
| Stichtag Schuelerzahl | 15. Oktober |
| Stellenplan einreichen | Vor Beginn des Haushaltsjahres |
| Jahresrechnung | Nach Ablauf des Haushaltsjahres |
| Versorgungsfaelle anmelden | 3 Monate vor Eintritt |

---

## 5. Bestehende Infrastruktur

### 5.1 n8n Workflow #221 "Personal: Untis Deputat Uebersicht"

**Ablauf (taeglich 8:00 Uhr):**
1. Liest aus Untis MSSQL: Teacher-Tabelle + Terms-Tabelle
2. Vergleicht mit letztem Snapshot aus PostgreSQL (`deputat_snapshot`)
3. Bei Aenderungen: HTML-E-Mail an `CREDO-Personal-intern@fes-credo.de`
4. Speichert neuen Snapshot in PostgreSQL

**SQL-Query liefert pro Lehrer:**
- TEACHER_ID, SCHOOLYEAR_ID, TERM_ID
- Name (Kuerzel), PNumber (Personalnummer), OwnSchool (Stammschule)
- Vollname, Deputat (PlannedWeek/1000)
- Deputat_GES, Deputat_GYM, Deputat_BK (aus PlannedPerDept geparst)
- Schuljahr_Text, Term_Zeitraum, DateFrom/DateTo

**PostgreSQL Snapshot-Schema (bestehende separate DB):**
```sql
deputat_snapshot (
  snapshot_datum DATE,
  teacher_id INTEGER,
  schoolyear_id INTEGER,
  term_id INTEGER,
  name VARCHAR,
  personalnummer VARCHAR,
  stammschule VARCHAR,
  vollname VARCHAR,
  deputat NUMERIC,
  deputat_ges NUMERIC,
  deputat_gym NUMERIC,
  deputat_bk NUMERIC,
  schuljahr_text VARCHAR
)
-- Upsert-Key: (snapshot_datum, teacher_id, schoolyear_id, term_id)
```

### 5.2 Excel-Vorlagen (aktueller manueller Prozess)

**Stellen-Ist-Berechnung GES.xlsx:**
- Zeilen = Lehrer, Spalten C-N = Jan-Dez (Wochenstunden)
- Spalte A = Stammschule (GES, GYM, etc.)
- Zeile 67: Summe Wochenstunden
- Zeile 69: Monats-Durchschnitt Stellen
- Zeilen 79-121: Mehrarbeit
- Zeile 126: Gesamtstellen (Ist)
- Zeile 127: Stellenplan (Soll aus Schuelerzahl-Berechnung)
- Zeile 133: Soll (mit Zuschlaegen)
- Zeile 134: Differenz (Soll - Ist)
- Zeilen 136-141: Schuelerzahlen-Berechnung mit SLR

**Schuelerzahlen 6 Schulen.xlsx:**
- 2023-2024: GES=530, GYM=457, GSH=184, GSM=202, GSS=203, BK=47 (Summe: 1623)
- 2024-2025: GES=569, GYM=455, GSH=183, GSM=202, GSS=200, BK=60 (Summe: 1669)

---

## 6. Datenbank-Schema (Neue Anwendung)

### Kern-Tabellen

```sql
-- Schulstammdaten
CREATE TABLE schulen (
    id              SERIAL PRIMARY KEY,
    schulnummer     VARCHAR(10) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    kurzname        VARCHAR(10) NOT NULL,
    untis_code      VARCHAR(10),
    schulform       VARCHAR(50) NOT NULL,
    adresse         VARCHAR(300),
    plz             VARCHAR(5),
    ort             VARCHAR(100),
    farbe           VARCHAR(7) NOT NULL DEFAULT '#575756',
    ist_im_aufbau   BOOLEAN NOT NULL DEFAULT FALSE,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stufen pro Schule (Sek I, Sek II, Primarstufe)
CREATE TABLE schul_stufen (
    id              SERIAL PRIMARY KEY,
    schule_id       INTEGER NOT NULL REFERENCES schulen(id),
    stufe           VARCHAR(50) NOT NULL,
    schulform_typ   VARCHAR(50) NOT NULL,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(schule_id, stufe)
);

-- Schuljahre
CREATE TABLE schuljahre (
    id              SERIAL PRIMARY KEY,
    bezeichnung     VARCHAR(20) NOT NULL UNIQUE,
    start_datum     DATE NOT NULL,
    end_datum       DATE NOT NULL,
    untis_schoolyear_id INTEGER UNIQUE,
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE
);

-- Haushaltsjahre (Kalenderjahre)
CREATE TABLE haushaltsjahre (
    id              SERIAL PRIMARY KEY,
    jahr            INTEGER NOT NULL UNIQUE,
    stichtag_vorjahr DATE,
    stichtag_laufend DATE,
    gesperrt        BOOLEAN NOT NULL DEFAULT FALSE
);

-- Schuelerzahlen je Schule/Stufe/Stichtag
CREATE TABLE schuelerzahlen (
    id              SERIAL PRIMARY KEY,
    schule_id       INTEGER NOT NULL REFERENCES schulen(id),
    schul_stufe_id  INTEGER NOT NULL REFERENCES schul_stufen(id),
    stichtag        DATE NOT NULL,
    anzahl          INTEGER NOT NULL CHECK (anzahl >= 0),
    bemerkung       TEXT,
    erfasst_von     VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schule_id, schul_stufe_id, stichtag)
);

-- SLR-Werte je Schuljahr und Schulform-Typ
CREATE TABLE slr_werte (
    id              SERIAL PRIMARY KEY,
    schuljahr_id    INTEGER NOT NULL REFERENCES schuljahre(id),
    schulform_typ   VARCHAR(50) NOT NULL,
    relation        NUMERIC(6,2) NOT NULL,
    quelle          VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schuljahr_id, schulform_typ)
);

-- Zuschlagsarten (Stammdaten)
CREATE TABLE zuschlag_arten (
    id              SERIAL PRIMARY KEY,
    bezeichnung     VARCHAR(100) NOT NULL UNIQUE,
    beschreibung    TEXT,
    ist_standard    BOOLEAN NOT NULL DEFAULT FALSE,
    sortierung      INTEGER NOT NULL DEFAULT 0
);

-- Zuschlagswerte je Schule/Haushaltsjahr
CREATE TABLE zuschlaege (
    id              SERIAL PRIMARY KEY,
    schule_id       INTEGER NOT NULL REFERENCES schulen(id),
    haushaltsjahr_id INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    zuschlag_art_id INTEGER NOT NULL REFERENCES zuschlag_arten(id),
    wert            NUMERIC(8,4) NOT NULL,
    zeitraum        VARCHAR(10) NOT NULL DEFAULT 'ganzjahr',
    bemerkung       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(schule_id, haushaltsjahr_id, zuschlag_art_id, zeitraum)
);

-- Lehrer (aus Untis via n8n)
CREATE TABLE lehrer (
    id              SERIAL PRIMARY KEY,
    untis_teacher_id INTEGER NOT NULL UNIQUE,
    personalnummer  VARCHAR(20),
    name            VARCHAR(50) NOT NULL,
    vollname        VARCHAR(200) NOT NULL,
    stammschule_id  INTEGER REFERENCES schulen(id),
    stammschule_code VARCHAR(10),
    aktiv           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monatliche Deputate (Kern fuer Stellenist)
CREATE TABLE deputat_monatlich (
    id              SERIAL PRIMARY KEY,
    lehrer_id       INTEGER NOT NULL REFERENCES lehrer(id),
    haushaltsjahr_id INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    monat           INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
    deputat_gesamt  NUMERIC(8,3),
    deputat_ges     NUMERIC(8,3) DEFAULT 0,
    deputat_gym     NUMERIC(8,3) DEFAULT 0,
    deputat_bk      NUMERIC(8,3) DEFAULT 0,
    quelle          VARCHAR(20) DEFAULT 'untis',
    untis_schoolyear_id INTEGER,
    untis_term_id   INTEGER,
    sync_datum      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lehrer_id, haushaltsjahr_id, monat)
);

-- Mehrarbeit
CREATE TABLE mehrarbeit (
    id              SERIAL PRIMARY KEY,
    lehrer_id       INTEGER NOT NULL REFERENCES lehrer(id),
    haushaltsjahr_id INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    monat           INTEGER NOT NULL CHECK (monat BETWEEN 1 AND 12),
    stunden         NUMERIC(8,2) NOT NULL DEFAULT 0,
    schule_id       INTEGER REFERENCES schulen(id),
    bemerkung       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lehrer_id, haushaltsjahr_id, monat, schule_id)
);

-- n8n Sync-Protokoll
CREATE TABLE deputat_sync_log (
    id              SERIAL PRIMARY KEY,
    sync_datum      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schuljahr_text  VARCHAR(20),
    term_id         INTEGER,
    anzahl_lehrer   INTEGER,
    anzahl_aenderungen INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'success',
    fehler_details  TEXT,
    rohdaten        JSONB
);

-- Berechnungsergebnisse Stellensoll
CREATE TABLE berechnung_stellensoll (
    id                      SERIAL PRIMARY KEY,
    schule_id               INTEGER NOT NULL REFERENCES schulen(id),
    haushaltsjahr_id        INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    zeitraum                VARCHAR(10) NOT NULL,
    grundstellen_details    JSONB NOT NULL,
    grundstellen_summe      NUMERIC(8,2) NOT NULL,
    grundstellen_gerundet   NUMERIC(8,1) NOT NULL,
    zuschlaege_summe        NUMERIC(8,4) NOT NULL DEFAULT 0,
    zuschlaege_details      JSONB,
    stellensoll             NUMERIC(8,1) NOT NULL,
    berechnet_am            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    berechnet_von           VARCHAR(100),
    ist_aktuell             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Berechnungsergebnisse Stellenist
CREATE TABLE berechnung_stellenist (
    id                              SERIAL PRIMARY KEY,
    schule_id                       INTEGER NOT NULL REFERENCES schulen(id),
    haushaltsjahr_id                INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    zeitraum                        VARCHAR(10) NOT NULL,
    monats_durchschnitt_stunden     NUMERIC(10,4),
    regelstundendeputat             NUMERIC(6,2),
    stellenist                      NUMERIC(8,4) NOT NULL,
    stellenist_gerundet             NUMERIC(8,1) NOT NULL,
    mehrarbeit_stellen              NUMERIC(8,4) NOT NULL DEFAULT 0,
    stellenist_gesamt               NUMERIC(8,1) NOT NULL,
    details                         JSONB,
    berechnet_am                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    berechnet_von                   VARCHAR(100),
    ist_aktuell                     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Soll-Ist-Vergleich
CREATE TABLE berechnung_vergleich (
    id                  SERIAL PRIMARY KEY,
    schule_id           INTEGER NOT NULL REFERENCES schulen(id),
    haushaltsjahr_id    INTEGER NOT NULL REFERENCES haushaltsjahre(id),
    stellensoll_id      INTEGER REFERENCES berechnung_stellensoll(id),
    stellenist_id       INTEGER REFERENCES berechnung_stellenist(id),
    stellensoll         NUMERIC(8,1) NOT NULL,
    stellenist          NUMERIC(8,1) NOT NULL,
    differenz           NUMERIC(8,1) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    refinanzierung      NUMERIC(8,1),
    berechnet_am        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit-Log
CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    tabelle         VARCHAR(50) NOT NULL,
    datensatz_id    INTEGER NOT NULL,
    aktion          VARCHAR(20) NOT NULL,
    alte_werte      JSONB,
    neue_werte      JSONB,
    benutzer        VARCHAR(100),
    zeitpunkt       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Seed-Daten

```sql
-- Zuschlagsarten
INSERT INTO zuschlag_arten (bezeichnung, beschreibung, ist_standard, sortierung) VALUES
    ('Leitungszeit (Schulleitung)', 'Leitungszeit fuer Schulleitung', TRUE, 1),
    ('Integration', 'Gemeinsames Lernen / Inklusion', TRUE, 2),
    ('KAoA', 'Kein Abschluss ohne Anschluss', TRUE, 3),
    ('Digitalisierungsbeauftragter', 'Digitalisierungsbeauftragter', TRUE, 4),
    ('Teilnahme an Schulleiterqualifikation', 'SLQ-Zuschlag', FALSE, 5),
    ('Ganztagszuschlag', 'Nur bei Refinanzierungszusage', FALSE, 6),
    ('Unterrichtsmehrbedarf', 'Sonderpaed. Foerderung etc.', FALSE, 7),
    ('Ausgleichsbedarf', 'Gem. Bewirtschaftungserlass', FALSE, 8);
```

---

## 7. Seitenstruktur & Navigation

```
/ (Dashboard)
  Uebersicht aller Schulen mit KPIs

/schuelerzahlen
  Schuelerzahlen pro Schule/Stufe/Stichtag verwalten

/slr-konfiguration
  SLR-Werte pro Schuljahr pflegen

/deputate
  Deputatsuebersicht (12-Monats-Grid wie Excel)
  /deputate/[lehrerId] - Einzelansicht Lehrer

/mehrarbeit
  Mehrarbeitsstunden erfassen

/stellensoll
  Stellensoll berechnen (Schritt-fuer-Schritt)
  /stellensoll/[schulnummer] - Pro Schule

/stellenist
  Stellenist berechnen
  /stellenist/[schulnummer] - Pro Schule

/vergleich
  Soll-Ist-Vergleich mit Ampellogik

/zuschlaege
  Zuschlaege pro Schule/Haushaltsjahr

/historie
  Berechnungshistorie / Audit-Trail

/export
  PDF und Excel Reports generieren

/einstellungen
  Schulverwaltung (CRUD)
```

---

## 8. n8n-Integration

### Neuer API-Endpoint: POST /api/deputate/sync

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

**Logik:**
1. API-Key validieren
2. Lehrer upserten (Match auf untis_teacher_id)
3. Term-Datumsbereich auf Monate mappen
4. Fuer jeden Monat im Bereich: deputat_monatlich upserten
5. Sync-Log schreiben
6. Zusammenfassung zurueckgeben

### n8n Workflow anpassen:
- Neuer HTTP-Request-Node nach "Daten fuer DB vorbereiten"
- Bestehender Snapshot-Flow bleibt unveraendert (Dual-Write)

---

## 9. Implementierungsphasen

| Phase | Woche | Inhalt |
|-------|-------|--------|
| 1 | 1-2 | Projekt-Setup, Design-System, DB-Schema, Layout-Komponenten |
| 2 | 3-4 | Schuelerzahlen, SLR-Konfiguration, Zuschlaege (Dateneingabe) |
| 3 | 5-6 | n8n-Integration, Deputatsuebersicht, Mehrarbeit |
| 4 | 7-8 | **Berechnungs-Engine** (Rundung, Grundstellen, Stellensoll, Stellenist) |
| 5 | 9-10 | Dashboard, Soll-Ist-Vergleich, Historie |
| 6 | 11-12 | Export (PDF/Excel), Feinschliff, Benutzertest |

---

## 10. UX-Prinzipien

- Min. 16px Schrift, 44px Button-Hoehe
- Keine versteckten Menues
- Deutsche Beschriftung (TT.MM.JJJJ, 1.234,56)
- Breadcrumb-Navigation
- Bestaetigung bei kritischen Aktionen
- Sticky Tabellenkopfzeilen
- Farbcodierung nach Schulform (CREDO CD)
- Desktop-First (1280px+)
- Alternating Row Colors in Tabellen

---

## 11. Test-Strategie

### Berechnungs-Tests (HOECHSTE PRIORITAET)

```typescript
// Rundung
truncateToDecimals(28.448738, 2) === 28.44  // NICHT 28.45!
truncateToDecimals(30.542136, 2) === 30.54
roundToDecimals(45.93, 1) === 45.9

// Grundstellen GES (aus Excel)
530 / 18.63 = 28.4487... → trunc(2) → 28.44 → round(1) → 28.4
569 / 18.63 = 30.5421... → trunc(2) → 30.54 → round(1) → 30.5

// Grundstellen GYM (aus Dokumentation)
600 / 19.87 = 30.19... → trunc(2) → 30.19
200 / 12.70 = 15.74... → trunc(2) → 15.74
Summe: 45.93 → round(1) → 45.9
```

### Integration mit bekannten Excel-Werten testen
- GES Jan-Jul 2024: 530 Schueler, SLR 18.63
- GES Aug-Dez 2024: 569 Schueler, SLR 18.63
- Stellenist gegen Excel Zeile 67-69 abgleichen
