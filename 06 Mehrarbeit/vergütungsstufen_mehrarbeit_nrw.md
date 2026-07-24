# Vergütungsstufen Mehrarbeit NRW — Stammdaten-Dokumentation
> **Zweck:** Vollständige, quellenbasierte Dokumentation der vier Vergütungsstufen (PEDAV-Schlüssel 1–4)
> für die Mehrarbeits-App der CREDO Gruppe. Dient als Grundlage für die Tabelle
> `vergütungsstufen` (PostgreSQL) und für die Prüflogik in Claude Code.
>
> **Rechtsquelle:** BASS 21-22 Nr. 22, Runderlass des Kultusministeriums vom 22. August 1980
> (GABl. NW. S. 507), zuletzt geändert durch RdErl. MSB vom 3. Dezember 2024.
> Volltext: https://bass.schule.nrw/1057.htm (abgerufen: 17.06.2026)
>
> **Übergeordnete Rechtsnorm:** § 4 Abs. 3 Mehrarbeitsvergütungsverordnung (MVergV) i.V.m.
> § 92 Abs. 1 Nr. 3 Landesbesoldungsgesetz NRW (LBesG NRW)
>
> **⚠ Wartungshinweis:** Diese Datei und die Datenbanktabelle `vergütungsstufen` MÜSSEN
> aktualisiert werden, sobald das MSB NRW die Sätze durch Runderlass anpasst.
> Typischer Rhythmus: nach jeder Besoldungsanpassung (ca. alle 1–2 Jahre).
> Prüfpflicht: BASS 21-22 Nr. 22 auf https://bass.schule.nrw/1057.htm beobachten.

---

## 1. Historische Entwicklung der Stundensätze

*Quelle: BASS 21-22 Nr. 22, Tabelle 1 (Änderungserlass vom 03.12.2024, BASS 2025/2026)*

| MVergV-Fallgruppe | PEDAV-Schlüssel | Satz bis Dez. 2022 | Satz Dez. 2022 – Okt. 2024 | Satz ab 01.11.2024 | **Satz ab 01.02.2025** |
|---|---|---|---|---|---|
| § 4 Abs. 3 Nr. 1 | 1 | (historisch) | 21,24 € | 22,25 € | **23,47 €** |
| § 4 Abs. 3 Nr. 2 | 2 | (historisch) | 26,32 € | 27,57 € | **29,09 €** |
| § 4 Abs. 3 Nr. 3 | 3 | (historisch) | 31,25 € | 32,74 € | **34,54 €** |
| § 4 Abs. 3 Nr. 4+5 | 4 | (historisch) | 36,54 € | 38,28 € | **40,39 €** |

> **Aktuell gültig: Sätze ab 01.02.2025.**
> Rechtsgrundlage der letzten Erhöhung: RdErl. MSB vom 03.12.2024 (BASS 21-22 Nr. 22,
> Änderungsfassung), MBl. NRW. 2024 S. 1014.

> **Sonderhinweis für Schlüssel 1:** Es existiert unterhalb von Schlüssel 1 noch ein
> niedrigerer Satz von 18,39 € für Tarifbeschäftigte EG 6 und EG 8 (Fallgruppen 1.6.2,
> 2.9.2, 3.13.2). Dieser wird vom PEDAV-Tool als Schlüssel 1 geführt; in der App ist er
> als Sonderfall (`schlüssel = 0` oder `sonderfall_eg6_eg8 = true`) zu kennzeichnen.

---

## 2. Vollständige Fallgruppenzuordnung nach BASS 21-22 Nr. 22

### 2.1 Schlüssel 1 — 23,47 €/Stunde (§ 4 Abs. 3 Nr. 1 MVergV)

**Gilt für Lehrkräfte, deren Qualifikation unter der A-12-Schwelle liegt.**

#### Beamtinnen und Beamte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 1.2 | GS / HS | Eingangsamt **unter** BesGr A 12 | 23,47 € |
| 2.3 | RS / FöS | Eingangsamt **nicht mindestens** A 12 | 23,47 € |
| 3.5 | GY / BK | Eingangsamt **nicht mindestens** A 12 | 23,47 € |
| 6.2 | GE / SK | Eingangsamt **nicht mindestens** A 12 | 23,47 € |

#### Tarifbeschäftigte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 1.6.1 | GS / HS | EG 9 oder EG 10, nicht von FG 1.3–1.5 erfasst | 23,47 € |
| 2.9.1 | RS / FöS | EG 9, 10 oder 11, nicht von FG 2.4–2.8 erfasst | 23,47 € |
| 3.13.1 | GY / BK | EG 11, 10 oder 9, nicht von FG 3.6–3.12 erfasst | 23,47 € |

#### Sonderfall: 18,39 €/Stunde (kein eigener PEDAV-Schlüssel, in App separat kennzeichnen)

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 1.6.2 | GS / HS | EG 6 oder EG 8 | 18,39 € |
| 2.9.2 | RS / FöS | EG 6 oder EG 8 | 18,39 € |
| 3.13.2 | GY / BK | EG 6 oder EG 8 | 18,39 € |

---

### 2.2 Schlüssel 2 — 29,09 €/Stunde (§ 4 Abs. 3 Nr. 2 MVergV)

**Gilt für Lehrkräfte mit Eingangsamt A 12 (gehobener Dienst, vollständige Lehrerausbildung
für GS/HS/RS-Bereich).**

#### Beamtinnen und Beamte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 1.1 | GS / HS | Eingangsamt BesGr **A 12** | 29,09 € |
| 2.2 | RS / FöS | Eingangsamt BesGr **A 12** | 29,09 € |
| 3.3 | GY / BK | Eingangsamt BesGr **A 12** | 29,09 € |

#### Tarifbeschäftigte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 1.3 | GS / HS | Lehrbefähigung für Lehramt mit Eingangsamt **A 12**, oder Sportlehrer (§ 93a LVO) | 29,09 € |
| 1.4 | GS / HS | Religionslehrkraft mit abgeschlossener theologischer Ausbildung | 29,09 € |
| 1.5 | GS / HS | Staatsprüfung für ein Lehramt (wiss. Hochschule), Unterricht in mind. 2 Fächern entspr. Studium | 29,09 € |
| 2.5 | RS / FöS | Lehrbefähigung für Lehramt mit Eingangsamt **A 12**, oder Sportlehrer (§ 93a LVO) | 29,09 € |
| 2.8 | RS / FöS | Staatsprüfung für Lehramt (wiss. Hochschule), nicht von FG 2.4–2.7 erfasst | 29,09 € |
| 3.7 | GY / BK | Lehrbefähigung für Lehramt mit Eingangsamt **A 13 gehobener Dienst** | 29,09 € |
| 3.8 | GY / BK | Lehrbefähigung für Lehramt mit Eingangsamt **A 12** | 29,09 € |

> **Abgrenzungshinweis 1.5 / 2.8:** Diese Fallgruppen schließen explizit aus:
> Diplom-Dolmetscher, Diplom-Übersetzer und Lehrkräfte, die ausschließlich für ein
> A-12-Lehramt ausgebildet sind (dann FG 2.5, nicht 2.7).

---

### 2.3 Schlüssel 3 — 34,54 €/Stunde (§ 4 Abs. 3 Nr. 3 MVergV)

**Gilt für Lehrkräfte mit Eingangsamt A 13 gehobener Dienst (RS/FöS-Bereich) sowie
Oberschullehrerinnen/-lehrer.**

#### Beamtinnen und Beamte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 2.1 | RS / FöS | Eingangsamt BesGr **A 13** (gehobener Dienst, RS/FöS) | 34,54 € |
| 3.2 | GY / BK | Eingangsamt BesGr **A 13 gehobener Dienst** (an GY/BK eingesetzt) | 34,54 € |
| 3.4 | GY / BK | **Oberschullehrerinnen/-lehrer** und Fachoberschullehrerinnen/-lehrer | 34,54 € |

#### Tarifbeschäftigte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 2.4 | RS / FöS | Lehrbefähigung für Lehramt mit Eingangsamt **A 13** | 34,54 € |
| 2.6 | RS / FöS | Religionslehrkraft mit abgeschlossener theologischer Ausbildung | 34,54 € |
| 2.7 | RS / FöS | Staatsprüfung wiss. Hochschule, mind. 2 Fächer, überwiegend im wiss. Fach (nicht A-12-Lehramt) | 34,54 € |

> **Wichtig für FöS:** An Förderschulen wird für höheren Dienst (A 13 hD) **Schlüssel 3**
> verwendet, nicht Schlüssel 4 — weil die Schulform RS/FöS ist und nicht GY/BK.

---

### 2.4 Schlüssel 4 — 40,39 €/Stunde (§ 4 Abs. 3 Nr. 4+5 MVergV)

**Gilt für Lehrkräfte an Gymnasien und Berufskollegs mit Eingangsamt A 13 höherer Dienst
(klassischer Studienrat).**

#### Beamtinnen und Beamte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 3.1 | GY / BK | Eingangsamt BesGr **A 13 höherer Dienst** (Studienrat) | 40,39 € |

> Auch A 14 (Oberstudienrat), A 15 (Studiendirektor) etc. fallen unter Nr. 3.1, da das
> **Eingangsamt** der Laufbahn maßgeblich ist, nicht das aktuelle Amt.

#### Tarifbeschäftigte

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 3.6 | GY / BK | Lehrbefähigung für Lehramt mit Eingangsamt **A 13 höherer Dienst** (z.B. 2. Staatsexamen GY) | 40,39 € |

#### Gesamtschule und Sekundarschule (Sonderregelung BASS Nr. 6)

| BASS-Nr. | Schulform | Kriterium | Betrag |
|---|---|---|---|
| 6.1a | GE / SK | Eingangsamt **mind. A 12** → maßgebender Vergütungssatz für dieses Eingangsamt | je nach Amt |
| 6.1b | GE / SK | Lehrbefähigung mit Eingangsamt **A 13 höherer Dienst** → A 13 hD-Satz | 40,39 € |
| 6.3 | GE / SK | Lehrbefähigung mit Eingangsamt **mind. A 13** (Tarifbeschäftigte) | 34,54 € |

> **Hinweis GE/SK:** Für Gesamtschulen und Sekundarschulen verweist BASS Nr. 6 auf die
> Vergütungssätze der anderen Schulformgruppen und staffelt nach Eingangsamt. Es gibt
> keinen eigenständigen GE-Satz — immer Durchstich auf Nr. 1–3.

---

## 3. Entscheidungsbaum: Welchen Schlüssel bekommt eine Lehrkraft?

```
START: Lehrkraft hat Mehrarbeit geleistet
│
├── Dienstverhältnis: BEAMTER
│   ├── Schulform: GS oder HS
│   │   ├── Eingangsamt A 12 oder höher → Schlüssel 2 (29,09 €)
│   │   └── Eingangsamt unter A 12       → Schlüssel 1 (23,47 €)
│   │
│   ├── Schulform: RS oder FöS
│   │   ├── Eingangsamt A 13 (beliebig)  → Schlüssel 3 (34,54 €)
│   │   ├── Eingangsamt A 12             → Schlüssel 2 (29,09 €)
│   │   └── Eingangsamt unter A 12       → Schlüssel 1 (23,47 €)
│   │
│   ├── Schulform: GY oder BK
│   │   ├── Eingangsamt A 13 höherer Dienst → Schlüssel 4 (40,39 €)
│   │   ├── Eingangsamt A 13 gehob. Dienst  → Schlüssel 3 (34,54 €)
│   │   │   (inkl. Oberschullehrer)
│   │   ├── Eingangsamt A 12                → Schlüssel 2 (29,09 €)
│   │   └── Eingangsamt unter A 12          → Schlüssel 1 (23,47 €)
│   │
│   └── Schulform: GE oder SK
│       → Eingangsamt bestimmt Satz (s. Nr. 6 BASS)
│
└── Dienstverhältnis: TARIFBESCHÄFTIGT (TVL)
    ├── Vollständige Lehrbefähigung für Lehramt mit Eingangsamt A 13 hD?
    │   └── JA → Schlüssel 4 (40,39 €)
    │
    ├── Vollständige Lehrbefähigung für Lehramt mit Eingangsamt A 13 gD
    │   oder Religionslehrk. RS/FöS mit theolog. Abschluss?
    │   └── JA → Schlüssel 3 (34,54 €)
    │
    ├── Vollständige Lehrbefähigung für Lehramt mit Eingangsamt A 12
    │   oder Religionslehrk. GS/HS mit theolog. Abschluss?
    │   └── JA → Schlüssel 2 (29,09 €)
    │
    ├── EG 9, 10 oder 11 (ohne vollständige Lehrbefähigung)?
    │   └── JA → Schlüssel 1 (23,47 €)
    │
    └── EG 6 oder EG 8?
        └── JA → Sonderfall 18,39 € (in App als Schlüssel 1S kennzeichnen)
```

---

## 4. PostgreSQL-Datenbankstruktur

### 4.1 Haupttabelle: `vergütungsstufen`

Diese Tabelle hält die **gültigen Stundensätze** mit Gültigkeitszeitraum.
Sobald das MSB die Sätze erhöht, wird ein **neuer Datensatz eingefügt** (kein Update) —
der alte Datensatz bleibt für historische Abrechnungen erhalten.

```sql
-- ============================================================
-- TABELLE: vergütungsstufen
-- Zweck:   Historisch korrekte Stundensätze für Mehrarbeit NRW
-- Quelle:  BASS 21-22 Nr. 22, https://bass.schule.nrw/1057.htm
-- ============================================================

CREATE TABLE vergütungsstufen (
    id                  SERIAL          PRIMARY KEY,

    -- Schlüssel 1–4 (entspricht PEDAV-Feld "Stundensatz")
    -- Sonderfall 0 = 18,39 € (EG 6/EG 8, unterhalb Schlüssel 1)
    pedav_schlüssel     SMALLINT        NOT NULL CHECK (pedav_schlüssel BETWEEN 0 AND 4),

    -- MVergV-Fallgruppe als Textanker für die Rechtsquelle
    mvergv_fallgruppe   VARCHAR(30)     NOT NULL,
    -- z.B. '§ 4 Abs. 3 Nr. 1', '§ 4 Abs. 3 Nr. 2' etc.

    -- Gültigkeit: INKLUSIV von, EXKLUSIV bis (NULL = noch gültig)
    gültig_ab           DATE            NOT NULL,
    gültig_bis          DATE            NULL,
    -- Invariante: gültig_bis IS NULL ODER gültig_bis > gültig_ab

    -- Der eigentliche Betrag in Euro (2 Dezimalstellen)
    stundensatz_euro    NUMERIC(6,2)    NOT NULL CHECK (stundensatz_euro > 0),

    -- Rechtsquelle für Audit und Nachvollziehbarkeit
    rechtsquelle_kurz   TEXT            NOT NULL,
    -- z.B. 'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024'
    rechtsquelle_url    TEXT            NULL,
    -- z.B. 'https://bass.schule.nrw/1057.htm'
    mbl_nrw_fundstelle  TEXT            NULL,
    -- z.B. 'MBl. NRW. 2024 S. 1014'

    -- Metadaten
    erfasst_am          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    erfasst_von         VARCHAR(100)    NOT NULL DEFAULT current_user,
    änderungsgrund      TEXT            NULL,
    -- z.B. 'Besoldungsanpassung NRW 2025, Artikel 2 RdErl. 03.12.2024'

    CONSTRAINT uq_schlüssel_ab UNIQUE (pedav_schlüssel, gültig_ab)
);

-- Index für Abfrage "welcher Satz gilt zu einem bestimmten Datum?"
CREATE INDEX idx_vgs_schlüssel_datum
    ON vergütungsstufen (pedav_schlüssel, gültig_ab, gültig_bis);

COMMENT ON TABLE vergütungsstufen IS
    'Historisch korrekte Stundensätze für Mehrarbeitsvergütung NRW nach BASS 21-22 Nr. 22. '
    'Neue Sätze werden als INSERT eingefügt (kein UPDATE), damit alte Abrechnungen '
    'nachvollziehbar bleiben. gültig_bis = NULL bedeutet: aktuell gültig.';
```

### 4.2 Seed-Daten: Alle bekannten Sätze ab Dez. 2022

```sql
-- ============================================================
-- SEED: vergütungsstufen
-- Stand: 17.06.2026 | Quelle: BASS 21-22 Nr. 22
-- URL:   https://bass.schule.nrw/1057.htm
-- ============================================================

INSERT INTO vergütungsstufen
    (pedav_schlüssel, mvergv_fallgruppe, gültig_ab, gültig_bis,
     stundensatz_euro, rechtsquelle_kurz, rechtsquelle_url, mbl_nrw_fundstelle, änderungsgrund)
VALUES

-- ── Schlüssel 0 (Sonderfall EG 6/EG 8) ──────────────────────
(0, '§ 4 Abs. 3 Nr. 1 (Sonderfall EG6/8)', '2022-12-01', '2024-10-31',
    18.39,
    'BASS 21-22 Nr. 22, Fassung Dez. 2022',
    'https://bass.schule.nrw/1057.htm', NULL,
    'Historischer Satz EG 6/8, Fallgruppen 1.6.2, 2.9.2, 3.13.2'),

(0, '§ 4 Abs. 3 Nr. 1 (Sonderfall EG6/8)', '2024-11-01', '2025-01-31',
    18.39,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 1',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.11.2024 — Satz EG 6/8 unverändert geblieben (kein Anpassungstatbestand)'),

(0, '§ 4 Abs. 3 Nr. 1 (Sonderfall EG6/8)', '2025-02-01', NULL,
    18.39,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 2',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.02.2025 — Satz EG 6/8 unverändert (kein Anpassungstatbestand)'),

-- ── Schlüssel 1 (§ 4 Abs. 3 Nr. 1) ──────────────────────────
(1, '§ 4 Abs. 3 Nr. 1', '2022-12-01', '2024-10-31',
    21.24,
    'BASS 21-22 Nr. 22, Fassung Dez. 2022',
    'https://bass.schule.nrw/1057.htm', NULL,
    'Historischer Satz, gültig bis Erhöhung Nov. 2024'),

(1, '§ 4 Abs. 3 Nr. 1', '2024-11-01', '2025-01-31',
    22.25,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 1',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.11.2024 gemäß LBesG NRW Anpassung'),

(1, '§ 4 Abs. 3 Nr. 1', '2025-02-01', NULL,
    23.47,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 2',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.02.2025 gemäß LBesG NRW Anpassung — aktuell gültig'),

-- ── Schlüssel 2 (§ 4 Abs. 3 Nr. 2) ──────────────────────────
(2, '§ 4 Abs. 3 Nr. 2', '2022-12-01', '2024-10-31',
    26.32,
    'BASS 21-22 Nr. 22, Fassung Dez. 2022',
    'https://bass.schule.nrw/1057.htm', NULL,
    'Historischer Satz'),

(2, '§ 4 Abs. 3 Nr. 2', '2024-11-01', '2025-01-31',
    27.57,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 1',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.11.2024'),

(2, '§ 4 Abs. 3 Nr. 2', '2025-02-01', NULL,
    29.09,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 2',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.02.2025 — aktuell gültig'),

-- ── Schlüssel 3 (§ 4 Abs. 3 Nr. 3) ──────────────────────────
(3, '§ 4 Abs. 3 Nr. 3', '2022-12-01', '2024-10-31',
    31.25,
    'BASS 21-22 Nr. 22, Fassung Dez. 2022',
    'https://bass.schule.nrw/1057.htm', NULL,
    'Historischer Satz'),

(3, '§ 4 Abs. 3 Nr. 3', '2024-11-01', '2025-01-31',
    32.74,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 1',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.11.2024'),

(3, '§ 4 Abs. 3 Nr. 3', '2025-02-01', NULL,
    34.54,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 2',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.02.2025 — aktuell gültig'),

-- ── Schlüssel 4 (§ 4 Abs. 3 Nr. 4+5) ────────────────────────
(4, '§ 4 Abs. 3 Nr. 4+5', '2022-12-01', '2024-10-31',
    36.54,
    'BASS 21-22 Nr. 22, Fassung Dez. 2022',
    'https://bass.schule.nrw/1057.htm', NULL,
    'Historischer Satz'),

(4, '§ 4 Abs. 3 Nr. 4+5', '2024-11-01', '2025-01-31',
    38.28,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 1',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.11.2024'),

(4, '§ 4 Abs. 3 Nr. 4+5', '2025-02-01', NULL,
    40.39,
    'BASS 21-22 Nr. 22, RdErl. MSB v. 03.12.2024 Art. 2',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. 2024 S. 1014',
    'Erhöhung ab 01.02.2025 — aktuell gültig');
```

### 4.3 Lookup-Funktion: Stundensatz zu einem bestimmten Datum

```sql
-- ============================================================
-- FUNKTION: get_stundensatz
-- Gibt den gültigen Stundensatz für einen Schlüssel zu einem
-- bestimmten Datum zurück. NULL wenn kein Satz gefunden.
-- ============================================================

CREATE OR REPLACE FUNCTION get_stundensatz(
    p_schlüssel   SMALLINT,
    p_datum       DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(6,2)
LANGUAGE sql
STABLE
AS $$
    SELECT stundensatz_euro
    FROM vergütungsstufen
    WHERE pedav_schlüssel = p_schlüssel
      AND gültig_ab      <= p_datum
      AND (gültig_bis IS NULL OR gültig_bis >= p_datum)
    ORDER BY gültig_ab DESC
    LIMIT 1;
$$;

-- Verwendung:
-- SELECT get_stundensatz(4, '2024-10-15');  -- → 36,54
-- SELECT get_stundensatz(4, '2024-11-01');  -- → 38,28
-- SELECT get_stundensatz(4, '2025-03-01');  -- → 40,39
-- SELECT get_stundensatz(4);                -- → 40,39 (heute)
```

### 4.4 Hilfstabelle: `schlüssel_mapping` (Laufbahn → PEDAV-Schlüssel)

```sql
-- ============================================================
-- TABELLE: schlüssel_mapping
-- Zweck:   Ordnet Schulform + Qualifikation dem PEDAV-Schlüssel
--          zu. Entlastet Sekretariat von manueller Eingabe.
-- ============================================================

CREATE TABLE schlüssel_mapping (
    id                  SERIAL          PRIMARY KEY,

    -- Schulform (aus Untis: GS, HS, RS, GY, BK, GE, SK, FÖS)
    schulform_kuerzel   VARCHAR(5)      NOT NULL,

    -- Dienstverhältnis aus Untis-Statistik-Feld (L, P, A, U, B, J, W, S, X)
    -- 'BEAMTER' = L, P, A, W | 'TARIF' = U, B, J
    dienstverhältnis    VARCHAR(10)     NOT NULL CHECK (dienstverhältnis IN ('BEAMTER','TARIF')),

    -- Für Beamte: Eingangsamt (A11, A12, A13_GD, A13_HD, A14, A15)
    -- A13_GD = gehobener Dienst | A13_HD = höherer Dienst
    eingangsamt         VARCHAR(10)     NULL,

    -- Für Tarifbeschäftigte: Lehramt-Kategorie
    -- GS_HS_A12 = Lehramt mit Eingangsamt A12
    -- RS_FÖS_A13_GD = Lehramt RS/FöS mit A13 gD
    -- GY_BK_A13_HD = Lehramt GY/BK mit A13 hD (Studienrat)
    -- RELIGION_GS = Religionslehrkraft theol. Abschluss GS/HS
    -- RELIGION_RS = Religionslehrkraft theol. Abschluss RS/FöS
    -- SPORT_A12 = Sportlehrer § 93a LVO
    -- EG9_EG10 | EG6_EG8 (ohne vollst. Lehrbefähigung)
    lehramt_kategorie   VARCHAR(30)     NULL,

    -- Resultierender PEDAV-Schlüssel
    pedav_schlüssel     SMALLINT        NOT NULL,

    -- Quelle für diese Zuordnung (BASS-Gliederungsnummer)
    bass_nr             VARCHAR(10)     NULL,
    -- z.B. '1.1', '3.6', '2.4'

    -- Freitextbemerkung für Edge Cases
    bemerkung           TEXT            NULL,

    CONSTRAINT uq_mapping UNIQUE (schulform_kuerzel, dienstverhältnis, eingangsamt, lehramt_kategorie)
);

-- Seed-Daten Mapping
INSERT INTO schlüssel_mapping
    (schulform_kuerzel, dienstverhältnis, eingangsamt, lehramt_kategorie, pedav_schlüssel, bass_nr, bemerkung)
VALUES
-- ── GS / HS — Beamte ─────────────────────────────────────────
('GS','BEAMTER','A12',   NULL, 2, '1.1', 'Grundschule, Eingangsamt A 12'),
('GS','BEAMTER','A11',   NULL, 1, '1.2', 'Grundschule, Eingangsamt unter A 12'),
('HS','BEAMTER','A12',   NULL, 2, '1.1', 'Hauptschule, Eingangsamt A 12'),
('HS','BEAMTER','A11',   NULL, 1, '1.2', 'Hauptschule, Eingangsamt unter A 12'),

-- ── GS / HS — Tarifbeschäftigte ──────────────────────────────
('GS','TARIF', NULL,'GS_HS_A12',    2, '1.3', 'TVL, Lehrbefähigung A-12-Lehramt'),
('GS','TARIF', NULL,'RELIGION_GS',  2, '1.4', 'TVL, Religionslehrkraft theol. Abschluss'),
('GS','TARIF', NULL,'SPORT_A12',    2, '1.3', 'TVL, Sportlehrer § 93a LVO'),
('GS','TARIF', NULL,'EG9_EG10',     1, '1.6.1', 'TVL, EG 9 oder 10, ohne vollst. Lehrbef.'),
('GS','TARIF', NULL,'EG6_EG8',      0, '1.6.2', 'TVL, EG 6 oder 8 — Sonderfall 18,39 €'),
('HS','TARIF', NULL,'GS_HS_A12',    2, '1.3', NULL),
('HS','TARIF', NULL,'EG9_EG10',     1, '1.6.1', NULL),
('HS','TARIF', NULL,'EG6_EG8',      0, '1.6.2', NULL),

-- ── RS / FöS — Beamte ────────────────────────────────────────
('RS', 'BEAMTER','A13_GD', NULL, 3, '2.1', 'Realschule, Eingangsamt A 13'),
('RS', 'BEAMTER','A12',    NULL, 2, '2.2', 'Realschule, Eingangsamt A 12'),
('RS', 'BEAMTER','A11',    NULL, 1, '2.3', 'Realschule, Eingangsamt unter A 12'),
('FÖS','BEAMTER','A13_GD', NULL, 3, '2.1', 'Förderschule, Eingangsamt A 13'),
('FÖS','BEAMTER','A12',    NULL, 2, '2.2', 'Förderschule, Eingangsamt A 12'),
('FÖS','BEAMTER','A11',    NULL, 1, '2.3', 'Förderschule, Eingangsamt unter A 12'),

-- ── RS / FöS — Tarifbeschäftigte ─────────────────────────────
('RS', 'TARIF', NULL,'RS_FÖS_A13',   3, '2.4', 'TVL, Lehrbefähigung A-13-Lehramt RS/FöS'),
('RS', 'TARIF', NULL,'GS_HS_A12',    2, '2.5', 'TVL, Lehrbefähigung A-12-Lehramt an RS'),
('RS', 'TARIF', NULL,'RELIGION_RS',  3, '2.6', 'TVL, Religionslehrkraft theol. Abschluss'),
('RS', 'TARIF', NULL,'EG9_EG10',     1, '2.9.1', 'TVL, EG 9–11, ohne vollst. Lehrbef.'),
('RS', 'TARIF', NULL,'EG6_EG8',      0, '2.9.2', 'TVL, EG 6 oder 8 — Sonderfall'),
('FÖS','TARIF', NULL,'RS_FÖS_A13',   3, '2.4', NULL),
('FÖS','TARIF', NULL,'GS_HS_A12',    2, '2.5', NULL),
('FÖS','TARIF', NULL,'EG9_EG10',     1, '2.9.1', NULL),
('FÖS','TARIF', NULL,'EG6_EG8',      0, '2.9.2', NULL),

-- ── GY / BK — Beamte ─────────────────────────────────────────
('GY','BEAMTER','A13_HD', NULL, 4, '3.1', 'Gymnasium, Studienrat (A 13 hD)'),
('GY','BEAMTER','A13_GD', NULL, 3, '3.2', 'Gymnasium, A 13 gehobener Dienst'),
('GY','BEAMTER','A12',    NULL, 2, '3.3', 'Gymnasium, Eingangsamt A 12'),
('GY','BEAMTER','A11',    NULL, 1, '3.5', 'Gymnasium, unter A 12'),
('BK','BEAMTER','A13_HD', NULL, 4, '3.1', 'Berufskolleg, Studienrat'),
('BK','BEAMTER','A13_GD', NULL, 3, '3.2', 'Berufskolleg, A 13 gD'),
('BK','BEAMTER','A12',    NULL, 2, '3.3', 'Berufskolleg, A 12'),
('BK','BEAMTER','A11',    NULL, 1, '3.5', NULL),

-- ── GY / BK — Tarifbeschäftigte ──────────────────────────────
('GY','TARIF', NULL,'GY_BK_A13_HD', 4, '3.6', 'TVL, 2. Staatsexamen GY/BK (A 13 hD)'),
('GY','TARIF', NULL,'RS_FÖS_A13',   3, '3.7', 'TVL, Lehrbefähigung A-13-gD an GY'),
('GY','TARIF', NULL,'GS_HS_A12',    2, '3.8', 'TVL, Lehrbefähigung A-12-Lehramt an GY'),
('GY','TARIF', NULL,'EG9_EG10',     1, '3.13.1', 'TVL, EG 9–11 an GY'),
('GY','TARIF', NULL,'EG6_EG8',      0, '3.13.2', 'TVL, EG 6 oder 8 — Sonderfall'),
('BK','TARIF', NULL,'GY_BK_A13_HD', 4, '3.6', NULL),
('BK','TARIF', NULL,'RS_FÖS_A13',   3, '3.7', NULL),
('BK','TARIF', NULL,'GS_HS_A12',    2, '3.8', NULL),
('BK','TARIF', NULL,'EG9_EG10',     1, '3.13.1', NULL),
('BK','TARIF', NULL,'EG6_EG8',      0, '3.13.2', NULL),

-- ── GE / SK — Gesamtschule / Sekundarschule ──────────────────
('GE','BEAMTER','A13_HD', NULL, 4, '6.1a', 'Gesamtschule, Eingangsamt A 13 hD'),
('GE','BEAMTER','A13_GD', NULL, 3, '6.1a', 'Gesamtschule, Eingangsamt A 13 gD'),
('GE','BEAMTER','A12',    NULL, 2, '6.1a', 'Gesamtschule, Eingangsamt A 12'),
('GE','BEAMTER','A11',    NULL, 1, '6.2',  'Gesamtschule, unter A 12'),
('GE','TARIF',  NULL,'GY_BK_A13_HD', 4, '6.1b', 'GE, TVL, Lehrbefähigung A 13 hD'),
('GE','TARIF',  NULL,'RS_FÖS_A13',   3, '6.3',  'GE, TVL, Lehrbefähigung mind. A 13'),
('SK','BEAMTER','A13_HD', NULL, 4, '6.1a', 'Sekundarschule'),
('SK','BEAMTER','A13_GD', NULL, 3, '6.1a', NULL),
('SK','BEAMTER','A12',    NULL, 2, '6.1a', NULL),
('SK','TARIF',  NULL,'GY_BK_A13_HD', 4, '6.1b', NULL);
```

---

## 5. Wartungsprozess bei Rechtsänderung

### 5.1 Wann muss die Tabelle aktualisiert werden?

Eine Aktualisierung ist **zwingend** erforderlich wenn:

1. **Das MSB NRW einen neuen Runderlass zu BASS 21-22 Nr. 22 veröffentlicht** — erkennbar im Amtsblatt Schule NRW (ABl. NRW.) oder direkt auf https://bass.schule.nrw/1057.htm
2. **Eine Besoldungsanpassung in NRW in Kraft tritt** — betrifft dann auch die MVergV-Sätze
3. **Die MVergV auf Bundesebene geändert wird** (selten, Bundesgesetzblatt BGBl.)

Beobachtungsintervall: Mindestens **halbjährlich** prüfen (BASS-Seite aufrufen und Tabelle 1 vergleichen).

### 5.2 Schritt-für-Schritt: Neue Sätze eintragen

```sql
-- SCHRITT 1: Alten aktuellen Satz schließen (gültig_bis setzen)
-- Beispiel: Neue Sätze gelten ab 01.08.2026
UPDATE vergütungsstufen
SET    gültig_bis = '2026-07-31'
WHERE  gültig_bis IS NULL;

-- SCHRITT 2: Neue Sätze einfügen
-- (Werte aus dem neuen RdErl. entnehmen!)
INSERT INTO vergütungsstufen
    (pedav_schlüssel, mvergv_fallgruppe, gültig_ab, gültig_bis,
     stundensatz_euro, rechtsquelle_kurz, rechtsquelle_url, mbl_nrw_fundstelle, änderungsgrund)
VALUES
(0, '§ 4 Abs. 3 Nr. 1 (Sonderfall EG6/8)', '2026-08-01', NULL,
    18.39, -- ← ggf. anpassen
    'BASS 21-22 Nr. 22, RdErl. MSB v. TT.MM.JJJJ',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. JJJJ S. XXX',
    'Besoldungsanpassung NRW JJJJ'),

(1, '§ 4 Abs. 3 Nr. 1', '2026-08-01', NULL,
    0.00, -- ← NEUEN BETRAG EINTRAGEN
    'BASS 21-22 Nr. 22, RdErl. MSB v. TT.MM.JJJJ',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. JJJJ S. XXX',
    'Besoldungsanpassung NRW JJJJ'),

(2, '§ 4 Abs. 3 Nr. 2', '2026-08-01', NULL, 0.00, -- ← anpassen
    'BASS 21-22 Nr. 22, RdErl. MSB v. TT.MM.JJJJ',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. JJJJ S. XXX', ''),
(3, '§ 4 Abs. 3 Nr. 3', '2026-08-01', NULL, 0.00, -- ← anpassen
    'BASS 21-22 Nr. 22, RdErl. MSB v. TT.MM.JJJJ',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. JJJJ S. XXX', ''),
(4, '§ 4 Abs. 3 Nr. 4+5', '2026-08-01', NULL, 0.00, -- ← anpassen
    'BASS 21-22 Nr. 22, RdErl. MSB v. TT.MM.JJJJ',
    'https://bass.schule.nrw/1057.htm', 'MBl. NRW. JJJJ S. XXX', '');

-- SCHRITT 3: Prüfabfrage — kein Datum darf zwei aktive Sätze haben
SELECT pedav_schlüssel, COUNT(*) AS anzahl_aktiv
FROM   vergütungsstufen
WHERE  gültig_bis IS NULL
GROUP BY pedav_schlüssel
HAVING COUNT(*) > 1;
-- → Muss leer zurückkommen!
```

### 5.3 Checkliste nach Aktualisierung

```
[ ] BASS 21-22 Nr. 22 (https://bass.schule.nrw/1057.htm) aufgerufen und Screenshot gesichert
[ ] Neues gültig_ab-Datum korrekt (laut RdErl., oft rückwirkend!)
[ ] Altes gültig_bis gesetzt (= neues gültig_ab minus 1 Tag)
[ ] Prüfabfrage aus Schritt 3 ergibt leeres Ergebnis
[ ] get_stundensatz(4, CURRENT_DATE) gibt neuen Betrag zurück
[ ] Testabrechnung mit bekannter Lehrkraft durchgeführt und Ergebnis plausibel
[ ] Änderungsgrund-Freitext vollständig ausgefüllt (Aktenzeichen RdErl. + MBl. NRW)
[ ] Diese MD-Datei aktualisiert (Abschnitt 1 und 2, neue Zeile in Historientabelle)
```

---

## 6. Vollständige Quellenangaben

| Dokument | Fundstelle | URL | Abrufdatum |
|---|---|---|---|
| BASS 21-22 Nr. 22 (konsolidierte Fassung) | RdErl. KM v. 22.08.1980 (GABl. NW. S. 507), zuletzt geänd. 03.12.2024 | https://bass.schule.nrw/1057.htm | 17.06.2026 |
| Änderungserlass mit Tabelle 1 (Erhöhung Nov. 2024 + Feb. 2025) | RdErl. MSB v. 03.12.2024 | https://bass.schule.nrw/20095.htm | 17.06.2026 |
| MVergV (Bundesrecht, Basis der Fallgruppen) | BGBl. I 1998 S. 3494, zuletzt geänd. BGBl. I 2004 S. 2774 | https://www.gesetze-im-internet.de/mvergv/ | 17.06.2026 |
| LBesG NRW § 92 Abs. 1 Nr. 3 (NRW-Anpassungsermächtigung) | GV. NRW. 2016 S. 310, ber. 642 | https://recht.nrw.de (LBesG) | 17.06.2026 |
| MBl. NRW 2024 S. 1014 (Besoldungsanpassung) | Ministerialblatt NRW | Nur gedruckt / über BASS abrufbar | 17.06.2026 |

---

*Dokument erstellt: 17.06.2026 | CREDO Gruppe / Mehrarbeits-App*
*Nächste Pflichtprüfung: spätestens 31.12.2026 oder bei neuem MSB-Runderlass*
