# Stellenistberechnung - Projektdokumentation

> **Stand:** 02. April 2026
> **Version:** 0.3.0
> **Projekt:** CREDO/FES Stellenistberechnung

---

## 1. Projekt-Ueberblick

### 1.1 Zweck
Webanwendung zur Berechnung der Stellenistberechnung (Personalstellen) fuer die CREDO/FES-Schulgruppe (Christlicher Schulverein Minden e.V.) als Ersatzschultraeger in NRW. Ersetzt den bisherigen manuellen Excel-Prozess.

### 1.2 Zielgruppe
Personalabteilung der CREDO Verwaltung. Klare, grosse UI, deutsche Beschriftung, keine versteckten Menues. Eine Vertretungsperson ohne Vorkenntnisse muss sich schnell zurechtfinden.

### 1.3 Schulen

| Kurzname | Name | Schulform | Schulnummer | Untis |
|----------|------|-----------|-------------|-------|
| GES | Freie Ev. Gesamtschule Minden | Gesamtschule | 195182 | Ja |
| GYM | Freies Ev. Gymnasium Minden | Gymnasium | 196083 | Ja |
| BK | Freies Ev. Berufskolleg Minden | Berufskolleg | 100166 | Ja |
| GSS | Grundschule Stemwede | Grundschule | 195054 | Nein |
| GSM | Grundschule Minderheide | Grundschule | 195844 | Nein |
| GSH | Grundschule Haddenhausen | Grundschule | 194608 | Nein |

---

## 2. Berechnungslogik

### 2.1 Stellensoll (§ 3 FESchVO)

**Formel:**
```
Stellensoll = Grundstellen + Zusaetzliche Stellenanteile (deputatswirksam)
```

**Grundstellen-Berechnung (NRW-konform):**
1. Pro Stufe: `Schueler / SLR` → Rohwert
2. Rohwert auf **2 Dezimalstellen ABSCHNEIDEN** (NICHT runden!)
3. Alle abgeschnittenen Werte **addieren**
4. Summe auf **1 Dezimalstelle kaufmaennisch runden**

**Zeitraeume:**
- Jan-Jul (7 Monate): Schuelerzahl vom Stichtag 15.10. **Vorjahr**
- Aug-Dez (5 Monate): Schuelerzahl vom Stichtag 15.10. **laufendes Jahr**

**Gewichteter Jahresdurchschnitt:**
```
Stellensoll_Jahr = (Stellensoll_JanJul × 7 + Stellensoll_AugDez × 5) / 12
```

### 2.2 Zusaetzliche Stellenanteile (Drei-Typen-Modell)

Die Software unterscheidet **vier Grundtypen** nach NRW-Recht:

| Typ | Bezeichnung | Wirkung | Anlage 2a |
|-----|-------------|---------|-----------|
| **A** | Stellenzuschlag (Abschnitt 2) | Erhoeht Stellensoll + Personalbedarfspauschale | Ja |
| **A_106** | Sonderbedarf § 106 Abs. 10 (Abschnitt 4) | Erhoeht Stellensoll, NICHT die Pauschale (isoliert) | Ja |
| **B** | Wahlleistung (Geld oder Stelle) | Stelle ODER EUR — Traeger waehlt | Nur bei Stellenwahl |
| **C** | Reine Geldleistung | Nur EUR-Betrag, keine Stellenwirkung | Nein |

**Drei-Gruppen-Logik im Stellensoll:**
- Typ A + A_106: fliessen **immer** ins Stellensoll (nur genehmigte)
- Typ B mit `wahlrecht = "stelle"`: fliesst ins Stellensoll
- Typ B mit `wahlrecht = "geld"`: **kein** Stellensoll-Effekt
- Typ C: **kein** Stellensoll-Effekt (nur EUR)

### 2.3 Stellenist

**Formel:**
```
Stellenist_JanJul = Summe(Wochenstunden Jan-Jul) / (7 × Regeldeputat)
Stellenist_AugDez = Summe(Wochenstunden Aug-Dez) / (5 × Regeldeputat)
Stellenist_Jahr = (JanJul × 7 + AugDez × 5) / 12
```

**Datenquellen:**
- GES/GYM/BK: Schulspezifische Spalten (`deputat_ges`, `deputat_gym`, `deputat_bk`) ueber ALLE Lehrer (Cross-School). Rechtsgrundlage: § 3 Abs. 1 FESchVO — tatsaechlich an der Schule erteilte Stunden.
- Grundschulen (GSH/GSM/GSS): `deputat_gesamt` nur fuer Lehrer der jeweiligen Stammschule.
- Manuelle Lehrer: Deputat wird bei Anlage/Bearbeitung fuer alle 12 Monate geschrieben.

### 2.4 Tagesgenaue Berechnung (bei Aenderungen)

**Standard:** Pro Monat gilt der letzte Sync-Wert (ein Wert pro Monat).

**Bei eingetragenem tatsaechlichem Datum:** Wenn HR in der Aenderungshistorie (`/deputate/[id]`) ein tatsaechliches Datum eintraegt, wird der Monatswert **tagesgewichtet** berechnet — analog zur Excel-Hilfstabelle (Spalten T/U/V):

```
Monats-Deputat = (Std_alt × Tage_vor_Aenderung + Std_neu × Tage_nach_Aenderung) / Monatstage
```

**Beispiel:** Aenderung am 09.02. von 10→17 Std. im Februar (28 Tage):
```
(10 × 8 + 17 × 20) / 28 = (80 + 340) / 28 = 15,0 Std.
```
Statt pauschal 17 (ohne tatsaechliches Datum).

**Implementierung:** `src/lib/berechnungen/tagesgenau.ts`
- Wird nur aktiv wenn `deputat_aenderungen.tatsaechliches_datum IS NOT NULL`
- Die Differenz zum pauschalen Wert wird als Korrektur auf die Monatssumme gerechnet
- Im Detail-JSON der Berechnung: `tagesgenauKorrektur` und `hatTagesgenauKorrekturen`

### 2.5 Soll-Ist-Vergleich

```
Differenz = Stellenist - Stellensoll
Status: <= 0 → "im_soll", <= 0.5 → "grenzbereich", > 0.5 → "ueber_soll"
Refinanzierung = min(Stellenist, Stellensoll)
```

### 2.6 Deputatstundenrahmen

```
Deputat-Soll = Stellensoll × Regeldeputat (Wochenstunden)
Deputat-Ist  = Gewichteter Durchschnitt der tatsaechlichen Wochenstunden
```

---

## 3. n8n-Sync (Untis → Webanwendung)

### 3.1 Endpoint: POST /api/deputate/sync

Empfaengt Deputatsdaten von n8n Workflow #223.

**WICHTIG: Haushaltsjahr-Zuordnung (Fix vom 02.04.2026)**
Das Haushaltsjahr wird **pro Monat** aus dem Kalenderjahr der Term-Periode bestimmt — NICHT aus dem Sync-Datum. Ein Term von "19.08.2024-08.09.2024" schreibt:
- Monat 8 (Aug) → HJ 2024
- Monat 9 (Sep) → HJ 2024

Ein Term der Jahresgrenzen ueberschreitet (z.B. "30.12.2024-19.01.2025") schreibt Dez nach HJ 2024 und Jan nach HJ 2025.

**Upsert-Logik:** Innerhalb eines Monats gewinnt der letzte gesynchte Term. Bei Monaten mit mehreren Perioden (z.B. Feb mit Term 10 und 11) steht der Wert des letzten Terms. Die tagesgenaue Korrektur erfolgt nur wenn HR ein tatsaechliches Datum eintraegt (siehe 2.4).

### 3.2 Deputat-Abweichungserkennung

In der Deputatsuebersicht wird ein Warnsymbol angezeigt wenn:
```
deputat_gesamt ≠ deputat_ges + deputat_gym + deputat_bk
```
Das bedeutet: In Untis sind Stunden nicht einem Department zugeordnet. Die Berechnung verwendet die schulspezifischen Spalten (korrekt), aber die Abweichung sollte in Untis geprueft werden.

### 3.3 Grundschulen (ohne Untis)

Grundschulen (GSH/GSM/GSS) haben keinen Untis-Sync. Lehrer werden manuell angelegt unter `/mitarbeiter` mit dem Feld "Deputat (Wochenstunden)". Dieses Deputat wird fuer alle 12 Monate des aktuellen HJ in `deputat_monatlich` geschrieben.

---

## 4. Stellenarten (31 Stueck, NRW-konform)

### Typ A — Standardzuschlaege (Abschnitt 2, 17 Stueck)
GT20, GT30, SLE, KAoA, GL-S, GL-K, LES-S, LES-K, SPF, SBV, BL, ANR, DAZ, MSU, UMB, AGL, SONST-A2

### Typ A_106 — Sonderbedarfe § 106 Abs. 10 (Abschnitt 4, 8 Stueck)
DIGI, SLQ, LES-10, FLB, OEF, BIL, VTR, ZB

### Typ B — Wahlleistungen (2 Stueck)
GOS-SEK1 (Uebermittagsbetreuung), GOS-GT-SEK1 (Ganztag Sek I)

### Typ C — Reine Geldleistungen (4 Stueck)
13PLUS, 8BIS1, SILEN, VZS

**Nicht enthalten:** Waldorfzuschlaege (keine Waldorfschule), Personalbedarfs-/Nebenkostenpauschale (automatisch berechnet, nicht als Stellenart).

---

## 5. Dashboard

### 5.1 Aufbau

**Schulfilter-Tabs:** Alle | GES | GYM | BK | GSH | GSM | GSS

**"Alle"-Ansicht:**
- 6 KPIs: Stellen Soll/Ist, Deputat Soll/Ist, Lehrkraefte, Stellenanteile
- Summentabelle mit Ampel pro Schule (klickbar → Schulansicht)

**Einzelschul-Ansicht:**
- 4 KPIs: Soll, Ist, Differenz, Lehrkraefte
- Stellensoll-Zusammensetzung als Balkendiagramm
- Stellenanteile-Kompaktliste mit Status-Dots
- Deputatstundenrahmen Soll/Ist mit visuellem Balken

### 5.2 Haushaltsjahr-Filter

URL-Parameter `?hj=2025` auf allen relevanten Seiten. Dropdown im Header. Standard: aktuelles Kalenderjahr.

Betroffene Seiten: Dashboard, Deputate, Stellenist, Stellensoll, Vergleich, Stellenanteile.

---

## 6. Datenbank-Schema (Kern-Aenderungen v0.3.0)

### stellenart_typen — neue Spalten
- `typ` (A, A_106, B, C)
- `kuerzel` (GT20, SLE, etc.)
- `anlage2a` (boolean)
- `erhoeht_pauschale` (boolean)
- `parametrisierbar` (boolean)
- `schulform_filter` (jsonb)

### stellenanteile — neue Spalten
- `eur_betrag` (numeric 12,2) — EUR-Betrag fuer Typ B/C
- `wahlrecht` (varchar 10) — "stelle" | "geld" | NULL

---

## 7. Wichtige Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/berechnungen/grundstellen.ts` | Grundstellen-Berechnung (Truncation + Rundung) |
| `src/lib/berechnungen/stellenist.ts` | Stellenist-Berechnung aus Monatsdaten |
| `src/lib/berechnungen/tagesgenau.ts` | Tagesgenaue Korrektur bei Aenderungen |
| `src/lib/berechnungen/vergleich.ts` | Soll-Ist-Vergleich mit gewichtetem Durchschnitt |
| `src/lib/berechnungen/rounding.ts` | truncateToDecimals (String-basiert!), roundToDecimals |
| `src/app/api/deputate/sync/route.ts` | n8n-Sync-Endpoint (HJ pro Monat) |
| `src/app/stellensoll/actions.ts` | Stellensoll-Berechnung (Drei-Gruppen-Logik) |
| `src/app/stellenist/actions.ts` | Stellenist-Berechnung (mit tagesgenauer Korrektur) |
| `src/lib/haushaltsjahr-utils.ts` | HJ-Auswahl via URL-Parameter |
| `src/db/seed-stellenarten.ts` | 31 Stellenarten nach NRW-Recht |

---

## 8. Rechtsgrundlagen

| Berechnung | Rechtsgrundlage |
|-----------|-----------------|
| Grundstellen | § 3 Abs. 1 FESchVO, § 107 Abs. 1 SchulG NRW |
| Rundungsregel | Nr. 7.1.1 AVO-RL, § 7 Abs. 1 Satz 2 VO zu § 93 Abs. 2 SchulG |
| Stichtag Schuelerzahl | § 3 FESchVO: 15. Oktober |
| SLR-Werte | § 8 VO zu § 93 Abs. 2 SchulG (jaehrlich) |
| Regeldeputat | § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW |
| Zuschlaege Abschnitt 2 | §§ 3, 3a, 3b FESchVO, AVO-RL |
| Sonderbedarfe Abschnitt 4 | § 106 Abs. 10 SchulG (isoliert nach § 3 Abs. 6) |
| Wahlleistungen | BASS 11-02 Nr. 24 |
| Geldleistungen | BASS 11-02 Nr. 9, § 44 LHO |
| Stellenist | § 3 Abs. 1 FESchVO |
| Tagesgenaue Erfassung | § 3 Abs. 1 FESchVO |

---

## 9. Bekannte Vereinfachungen

1. **Monatswert bei Periodengrenze:** Wenn ein Monat von mehreren Untis-Perioden abgedeckt wird, gilt der Wert der letzten Periode — AUSSER HR traegt ein tatsaechliches Datum ein (dann tagesgewichtet).
2. **Deputat-Abweichung Untis:** `deputat_gesamt` (PlannedWeek/1000) kann von der Summe der schulspezifischen Spalten abweichen. Die Berechnung verwendet die schulspezifischen Spalten.
3. **Befoerderungsstellen:** Die Phasenverschiebung (3 Jahre) ist noch nicht implementiert.
4. **TV-L-Pauschalen:** Personalbedarfs- und Personalnebenkostenpauschale werden noch nicht automatisch berechnet.
