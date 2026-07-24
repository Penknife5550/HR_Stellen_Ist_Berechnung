# Mehrarbeit NRW — Rechtsdokumentation für Untis-Integration
> **Zweck dieser Datei:** Vollständige rechtliche und technische Grundlage für die Mehrarbeitsberechnung im PEDAV Untis-Tool-Kontext. Diese Datei dient als Wissensgrundlage für Claude Code beim Zugriff auf Untis-Daten und bei der Validierung von Berechnungen.
>
> **Erstellt durch:** Drei-Agenten-System (Rechts-Agent → Advocatus-Diaboli-Agent → Synthese-Agent)
>
> **Stand:** 17. Juni 2026 | Gültig für Schuljahr 2025/2026

---

## AGENT 1 — Rechtlicher Rahmen NRW (Rechtsexperte, 30+ Jahre Erfahrung)

### 1.1 Primäre Rechtsquellen (Hierarchie)

```
1. § 61 Landesbeamtengesetz NRW (LBG NRW)          ← Gesetzliche Grundlage
2. § 66 Abs. 1 Landesbesoldungsgesetz NRW (LBesG)   ← Vergütungsrecht
3. Mehrarbeitsvergütungsverordnung (MVergV)           ← Berechnungsregeln
4. VwV zur MVergV                                    ← Verwaltungsdurchführung
5. BASS 21-22 Nr. 21 (RdErl. KM v. 11.06.1979)     ← Schulspezifische Umsetzung
6. BASS 21-22 Nr. 22 (Vergütungssätze)              ← Aktuelle Beträge
7. VO zu § 93 Abs. 2 SchulG (BASS 11-11 Nr. 1)     ← Pflichtstundenzahlen
8. § 44 TV-L Nr. 2                                   ← Analog für Tarifbeschäftigte
```

> **Kritisch:** Seit 7. Juni 2025 ist § 61 Abs. 1 LBG NRW geändert. Die Neuregelung zur Bagatellgrenze für Teilzeitbeschäftigte gilt für **alle nach diesem Datum geleisteten, noch nicht abgerechneten** Stunden.

---

### 1.2 Pflichtstundentabelle nach Schulform (aktuell ab 2004, NRW)

Dies ist die rechtlich maßgebliche Tabelle aus der VO zu § 93 Abs. 2 SchulG (BASS 11-11 Nr. 1):

| Schulform | Untis-Kürzel | Wöchentliche Pflichtstunden (Vollzeit) | PEDAV Wochenstundensoll |
|-----------|-------------|----------------------------------------|------------------------|
| Grundschule | GS | 28,0 | 28 |
| Hauptschule | HS | 28,0 | 28 |
| Realschule | RS | 28,0 | 28 |
| Gymnasium | GY | 25,5 | 25,5 |
| Gesamtschule | GE / GM | 25,5 | 25,5 |
| Sekundarschule | SK | 25,5 | 25,5 |
| Gemeinschaftsschule | GM | 25,5 | 25,5 |
| Berufskolleg | BK | 25,5 | 25,5 |
| Förderschule | FöS / S / SB / SG / SR | 27,5 | 27,5 |
| Weiterbildungskolleg | WB | variiert | 25,5 (Regelfall) |
| Primusschule | PS | 25,5 | 25,5 |

> **Rundungsregel (§ 2 Abs. 1 Satz 2 VO):** An Gymnasien, Gesamtschulen, Berufskollegs und Förderschulen wird die Pflichtstundenzahl alternierend auf- und abgerundet — je Schuljahr wechselnd. Das PEDAV Tool muss das im Minutenmodell berücksichtigen.

> **Wichtig für Ersatzschulen (CREDO):** Bei Ersatzschulen gelten dieselben Pflichtstundenzahlen wie an vergleichbaren öffentlichen Schulen (§ 105 ff. SchulG NRW).

---

### 1.3 Verpflichtung zur Mehrarbeit (§ 61 LBG NRW)

Eine Lehrkraft ist zur Mehrarbeit **verpflichtet**, wenn:
- zwingende dienstliche Verhältnisse vorliegen (Unterrichtsvertretung, struktureller Mangel)
- die Anordnung durch Schulleitung schriftlich erfolgt oder genehmigt wurde
- kein Schwerbehinderungsstatus mit zusätzlicher Stundenreduzierung besteht

**Nicht vergütbare Tätigkeiten** (kein Mehrarbeitsanspruch):
- Eltern- und Schülersprechtage
- Konferenzen, Dienstbesprechungen, Prüfungsaufsichten
- Fortbildungsveranstaltungen
- Schulfahrten (als Begleitung)
- Schulfeste, Schulgottesdienste
- Erledigung von Verwaltungsarbeit

**Vergütbare Unterrichtstätigkeit liegt vor bei:**
- Erteiltem Unterricht über das Pflichtstundensoll hinaus
- Unterricht durch Referendare unter Anleitung der Mehrarbeitslehrkraft
- Lernzielkontrollen (§ 2.2.2.3 BASS 21-22 Nr. 21)
- Klausuraufsicht im Rahmen angeordneter Mehrarbeit (§ 2.2.2.4 BASS 21-22 Nr. 21)

---

### 1.4 Verrechnungslogik — Vollzeitlehrkräfte

**Berechnungszeitraum:** immer der **Kalendermonat** (nicht das Schuljahr, nicht die Woche)

**Berechnungsformel:**
```
Mehrarbeit_netto = IST-Stunden − SOLL-Stunden − Ausfallstunden_mit_Rechtsanspruch
```

**Bagatellgrenze (Vollzeit):**
- Unterhalb von **3 Unterrichtsstunden** im Monat: keine Vergütung, keine Verrechnung
- Ab der **4. Stunde** (inklusive): alle geleisteten Stunden werden vergütet
- Obergrenze: **24 Unterrichtsstunden** pro Monat vergütbar
- Jahresobergrenze: **288 Unterrichtsstunden** pro Kalenderjahr

**Kennzeichnung im LBV-Bogen:** Vergütete Mehrarbeit erhält den Vermerk `V` für den jeweiligen Monat.

**Ausfallstunden mit Rechtsanspruch (anrechenbar):**
- Krankheit (Dienstunfähigkeit mit Attest)
- Beurlaubung unter Fortzahlung der Bezüge
- Feiertage / Ferien
- Dienstbefreiung nach § 29 TV-L
- Wahrnehmung einer Nebentätigkeit nach § 48 LBG

**Ausfallstunden OHNE Rechtsanspruch (nicht anrechenbar, werden mit Mehrarbeit verrechnet):**
- Ausfall durch schulorganisatorische Maßnahmen ohne Rechtsgrundlage
- Spontaner Entfall ohne Begründung

---

### 1.5 Verrechnungslogik — Teilzeitlehrkräfte (ab 07.06.2025 neue Rechtslage!)

**Rechtsgrundlage:** § 61 Abs. 1 LBG NRW n.F. (in Kraft seit 07.06.2025)

#### Phase 1: Unterhalb der Vollzeitgrenze

| Tatbestand | Regelung |
|-----------|---------|
| Betrachtungszeitraum | **Pro Kalenderwoche** (nicht Monat!) |
| Ausfallsaldierung | Nicht zulässig bis zur Vollzeitgrenze |
| Freizeitausgleich | Nicht über Wochengrenzen hinweg möglich |
| Vergütung | Erst nach Überschreiten der individuellen Bagatellgrenze |

**Bagatellgrenze Teilzeit (NEU ab 07.06.2025):**
```
Individuelle_Bagatellgrenze = 3 Unterrichtsstunden × Teilzeitquote
```

Beispiele:
- 60%-Teilzeit: 3 × 0,60 = **1,8 Std.** → Vergütung erst ab der 2. Stunde
- 50%-Teilzeit (Halbzeit): 3 × 0,50 = **1,5 Std.** → Vergütung erst ab der 2. Stunde
- 75%-Teilzeit: 3 × 0,75 = **2,25 Std.** → Vergütung ab der 3. Stunde

> **Kritische Praxisregel:** Wird die anteilige Bagatellgrenze NICHT überschritten, gibt es keinen Vergütungsanspruch — auch nicht für die geleisteten Stunden unterhalb der Grenze.

#### Phase 2: Ab Erreichen der Vollzeitgrenze

Sobald das Vollzeitstundendeputat in einer Woche erreicht wird:
- Weitere Stunden gelten als **Vollzeitmehrarbeit**
- Die **Vollzeitregeln** greifen (Bagatellgrenze: 3 Stunden, Abrechnung monatlich)
- Freisetzungen werden **erst ab diesem Punkt** negativ bewertet
- **Doppelte Bagatellgrenze ist unzulässig** (BVerwG 23.09.2010 – 2 C 27/09)

**Kombination in einem Monat möglich:**
Eine Lehrkraft kann in einem Monat sowohl "Teilzeitmehrarbeit" als auch "Vollzeitmehrarbeit" aufweisen. Das PEDAV-Tool weist diese separat aus (zwei Werte in der Übersichtsliste).

---

### 1.6 Vergütungssätze (BASS 21-22 Nr. 22, Stand ab 01.02.2025)

Der Vergütungsschlüssel (Feld `Stundensatz` in Untis) entspricht:

| Schlüssel | Besoldungsgruppe / Dienstverhältnis | Betrag/Std. (ca.) |
|-----------|--------------------------------------|-------------------|
| 1 | Gehobener Dienst (allgemein), soweit nicht 2 oder 3 | ~26 € |
| 2 | Gehobener Dienst ab A 12 + höherer Dienst GS/HS | ~31 € |
| 3 | Gehobener Dienst ab A 13 + höherer Dienst FöS/RS | ~35 € |
| 4 | Höherer Dienst GY, BK, Kollegschule, FH | ~38 € |

> **Hinweis:** Genaue Beträge werden durch das LBV nach Besoldungserhöhungen automatisch angepasst. Das PEDAV-Tool übergibt den Schlüssel (1–4), das LBV berechnet den Eurobetrag eigenständig.

---

### 1.7 Rechtsverhältnis-Kennzeichen (Feld `Statistik` in Untis-Lehrerstammdaten)

| Kürzel | Rechtsverhältnis | Teilzeit-Ergänzung |
|--------|-----------------|-------------------|
| L | Beamter auf Lebenszeit | L, T |
| P | Beamter auf Probe | P, T |
| A | Beamter auf Probe zur Anstellung | A, T |
| N | Beamter, nebenamtlich | — |
| W | Beamter auf Widerruf (LAA) | — |
| U | Angestellte, unbefristet (TVL) | U, T |
| B | Angestellte, befristet (TVL) | B, T |
| J | Angestellte, nicht TVL | J, T |
| S | Gestellungsvertrag | — |
| X | Unentgeltlich Beschäftigte | — |

> **Parsing-Regel:** Das Komma-T (z. B. `L, T`) signalisiert Teilzeitbeschäftigung. Der Code muss dieses Feld zuverlässig parsen.

---

### 1.8 Freie Evangelische Schulen / Ersatzschulen (CREDO-Kontext)

**Rechtsgrundlage Ersatzschulfinanzierung:** §§ 105–115 SchulG NRW

Für die Personalkostenanrechnung gilt:
- Personalkosten werden **höchstens in Höhe des Betrages** anerkannt, den das Land NRW für einen vergleichbaren Lehrer an einer öffentlichen Schule aufwenden muss
- Die Mehrarbeitsregelung gilt analog für Ersatzschullehrkräfte, sofern sie im öffentlichen Dienst beschäftigt sind
- Vergütungssätze nach BASS 21-22 Nr. 22 sind **identisch** mit öffentlichen Schulen
- **Für die Refinanzierung durch das Land** ist der korrekte LBV-Bogen entscheidend

> **CREDO-spezifisch:** Die FES-Schulen in Minden beschäftigen Lehrkräfte in verschiedenen Rechtsverhältnissen (U, B, L, P). Die korrekte Eingabe im Feld `Statistik` in Untis ist Voraussetzung für die fehlerfreie LBV-Abrechnung und damit für die Erstattung durch das Land NRW.

---

## AGENT 2 — Advocatus Diabolus (kritische Prüfung und Fehlerquellen)

### 2.1 Kritikpunkte an der PEDAV-Implementierung (laut Handbuch)

#### Problem 1: Keine Garantie für Rechtssicherheit
> *Originalzitat PEDAV-Handbuch (S. 14):* „Wir übernehmen keine Garantie, dass die abgebildeten Werte, rechtssicher berechnet wurden. Ferner übernehmen wir keine Garantie über aktuelle Urteile, oder Gesetzesänderungen."

**Konsequenz für Claude Code:** Claude Code darf NIEMALS blind die PEDAV-Ausgabe übernehmen. Jede Berechnung muss gegen die hier dokumentierten Rechtsnormen validiert werden.

#### Problem 2: Neue Bagatellgrenze für Teilzeit (ab 07.06.2025) — Unklar ob PEDAV aktualisiert
Das PEDAV-Handbuch (Copyright 2026) beschreibt die Teilzeitabrechnung noch nach **alter Rechtslage** (Abrechnung ab der 1. Stunde). Die gesetzliche Neuregelung des § 61 LBG NRW ist am 07.06.2025 in Kraft getreten.

**Risiko:** Das PEDAV-Tool Version 2026 könnte die alte Logik noch verwenden. Claude Code muss dies prüfen.

**Validierungstest:**
```
WENN Teilzeit-Lehrkraft mit 60% Deputat 1 Mehrarbeitsstunde im Monat hat
→ PEDAV-Ausgabe sollte: 0 € (keine Vergütung, unter Bagatellgrenze 1,8 Std.)
→ ALTE Logik würde: 1 Stunde vergüten
```

#### Problem 3: Wochengrenze vs. Monatsgrenze — Verwechslungsgefahr
Das PEDAV-Handbuch verwendet beide Bezugsgrößen:
- Vollzeit: Abrechnung **monatlich**, aber Verrechnung innerhalb des Monats
- Teilzeit: Betrachtung **pro Kalenderwoche**

**Risiko:** Wenn Untis-Daten nach KW aggregiert werden und das Tool dann monatlich summiert, können Rundungsfehler oder Zuordnungsfehler entstehen.

#### Problem 4: Freisetzungen — Behandlung unterscheidet sich nach Beschäftigungsgrad
- **Vollzeit:** Freisetzungen werden negativ bewertet (reduzieren die Mehrarbeit)
- **Teilzeit:** Freisetzungen werden erst ab Erreichen des vollen Deputats negativ bewertet

**Risiko:** Falsche Freisetzungsverrechnung bei Teilzeitlehrkräften — häufige Fehlerquelle.

**Optionale Einstellung im PEDAV-Tool:** Checkbox „Vertretung anstelle Unterrichtswert bei Freisetzungen zählen" — diese Einstellung muss dokumentiert sein.

#### Problem 5: Betreuungsstunden — Standardwert in Untis ist 0
Untis trägt für Betreuungsstunden standardmäßig den Wert `0` ein. Wenn das Schulen nicht korrigieren, werden Betreuungen auch bei aktivierter Checkbox nicht als Mehrarbeit gewertet.

**Prüfpflicht:** Vor jedem LBV-Export kontrollieren, ob Betreuungswerte in Untis korrekt hinterlegt sind.

#### Problem 6: Anrechnungsgründe — veraltete Codes können in Untis stehen
ASD-Anrechnungsgrund 280 existiert offiziell nicht mehr, kann aber noch in alten Untis-Dateien stehen. Das PEDAV-Tool lässt diese dann unzugeordnet — stille Fehlerquelle.

**Prüfpflicht:** Vor UVD-Export alle Anrechnungsgründe im PEDAV-Tool auf Zuordnung prüfen.

#### Problem 7: Multi-User-Login-Problem
Das PEDAV-Handbuch warnt ausdrücklich: Bei falschem Passwort gibt es **keine Fehlermeldung** — das Feld wird nur geleert. Claude Code muss daher den erfolgreichen Login explizit verifizieren.

---

### 2.2 Rechtliche Graubereiche und Offene Fragen

#### Graubereich 1: Ersatzschulen und Beamtenstatus
Lehrkräfte an kirchlichen Ersatzschulen wie den FES Minden sind häufig **nicht verbeamtet** (Angestellte nach TVL). Die Mehrarbeitsregeln gelten für sie analog (Nr. 2 zu § 44 TV-L), aber:
- Es gibt **keine direkte LBV-Personalnummer** für alle Angestellten
- Der Vergütungsschlüssel (1–4) muss manuell gepflegt werden
- Die Refinanzierung durch das Land läuft über **§ 105 SchulG**, nicht direkt über das LBV

**Empfehlung:** Bei Angestellten (U, B) separat validieren, ob der LBV-Bogen tatsächlich der richtige Übermittlungsweg ist.

#### Graubereich 2: Altersermäßigung und Schwerbehinderung
Lehrkräfte ab einem bestimmten Alter haben Anspruch auf Stundenreduzierung (Altersermäßigung). Bei Schwerbehinderung kann eine zusätzliche Reduzierung erfolgen.

**Konsequenz:** Das individuelle Pflichtstundensoll in Untis (UVD) kann **unter** dem Schulform-Standard liegen. Die Mehrarbeitsberechnung bezieht sich immer auf das **individuelle** Soll aus der UVD, nicht auf den Schulform-Standard.

#### Graubereich 3: Anrechnung von Ausfallstunden
Die Grenze zwischen „anrechenbaren" und „nicht anrechenbaren" Ausfallstunden ist komplex:
- Elternzeit: anrechenbar (Rechtsanspruch)
- Schulorganisatorischer Ausfall ohne Vertretungsregelung: nicht anrechenbar
- Ausfall wegen Schülerausflug, zu dem Lehrkraft nicht eingeteilt war: nicht anrechenbar

Diese Unterscheidung beeinflusst die Nettoberechnung der Mehrarbeit erheblich.

---

### 2.3 Datenbankfelder in Untis: Kritische Felder für die Mehrarbeitsberechnung

| Untis-Feld | Speicherort | Bedeutung | Fehlerrisiko |
|-----------|------------|-----------|-------------|
| `Statistik` | Lehrerstammdaten → Allgemeines | Rechtsverhältnis (L, P, U etc.) | Leer = keine Abrechnung möglich |
| `Personal-Nummer` | Lehrerstammdaten | LBV-Personalnummer | Falsch = LBV kann nicht zuordnen |
| `Stundensatz` | Lehrerstammdaten | Vergütungsschlüssel (1–4) | Falsch = falscher Eurobetrag |
| `Wert` | Vertretungsplanung | Wertigkeit der Vertretungsstunde | 0 = nicht gewertet |
| `Statistik` | Raum-Stammdaten | `X` = Distanzraum | Verwechslung mit Fix (X)! |
| `Statistik` | Klassen-Stammdaten | Jahrgangsstufe (z.B. `05`) | Leer = ASD-Fehler |
| `Statistik` | Unterricht | `N` = nicht zählen | Vergessen = falscher ASD |

---

## AGENT 3 — Synthese: Vollständige Technische Spezifikation für Claude Code

### 3.1 Architekturübersicht: Untis → PEDAV → LBV-Bogen

```
┌─────────────────────────────────────────────────────────┐
│                    UNTIS (Quelldaten)                     │
│                                                          │
│  Lehrerstammdaten    Vertretungsplanung    Stundenpläne  │
│  ├─ Statistik-Kz.    ├─ Vertretungen       ├─ IST-Std.  │
│  ├─ Personal-Nr.     ├─ Entfälle           ├─ Fächer    │
│  ├─ Stundensatz      ├─ Freisetzungen      └─ Klassen   │
│  └─ Geburtsdatum     └─ Absenzen                        │
└─────────────────┬───────────────────────────────────────┘
                  │ PEDAV Untis-Tool liest direkt (kein Export!)
                  ▼
┌─────────────────────────────────────────────────────────┐
│              PEDAV UNTIS-TOOL (Verarbeitung)             │
│                                                          │
│  LBV-Konverter     Berechnungslogik    Validierung       │
│  ├─ Vollzeit       ├─ IST vs. SOLL     ├─ Fehlercheck   │
│  ├─ Teilzeit       ├─ Bagatellgrenze   └─ Warnungen     │
│  └─ Vergütung      └─ Freisetzungen                     │
└─────────────────┬───────────────────────────────────────┘
                  │ Export als PDF
                  ▼
┌─────────────────────────────────────────────────────────┐
│              LBV-BOGEN (Abrechnungsdokument)             │
│  ├─ Pro Lehrkraft ein PDF                               │
│  ├─ Pro Kalendermonat                                   │
│  └─ Enthält: KW, Datum, Stunde, Wert, Fach, Klasse,    │
│              Grund, Abrechungssumme NRW                  │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 Berechnungsalgorithmus: Vollständige Spezifikation

#### 3.2.1 Vollzeitlehrkräfte — Monatsberechnung

```
EINGABE:
  - Soll-Stunden = individuelle Pflichtstundenzahl aus UVD (Untis-Feld)
  - Ist-Stunden  = tatsächlich erteilte Unterrichtsstunden im Kalendermonat
  - Ausfallstunden_anrechenbar = Stunden mit Rechtsanspruch (Krankheit, Urlaub etc.)
  - Freisetzungen = erteilte Stunden, bei denen Lehrkraft freigestellt war
  - Entfälle = nicht erteilte Pflichtstunden ohne Rechtsanspruch

BERECHNUNG:
  Netto_IST = Ist-Stunden + Ausfallstunden_anrechenbar
  Mehrarbeit_brutto = MAX(0, Netto_IST - Soll-Stunden)
  Mehrarbeit_netto = Mehrarbeit_brutto - Freisetzungen

VERGÜTUNGSPRÜFUNG:
  WENN Mehrarbeit_netto < 3 → Vergütung = 0 (Bagatellgrenze nicht überschritten)
  WENN Mehrarbeit_netto >= 3 UND <= 24 → Vergütung = Mehrarbeit_netto × Stundensatz
  WENN Mehrarbeit_netto > 24 → Vergütung = 24 × Stundensatz (Obergrenze)

AUSGABE:
  - Kennzeichen 'V' für den Abrechnungsmonat
  - Anzahl vergüteter Stunden
  - Betrag (LBV berechnet final aus Schlüssel 1–4)
```

#### 3.2.2 Teilzeitlehrkräfte — Wochenberechnung (ab 07.06.2025)

```
EINGABE:
  - Vollzeit-Soll = Schulform-Pflichtstunden (z.B. 25,5 für GY)
  - Teilzeit-Anteil = individuelle Stunden / Vollzeit-Soll (z.B. 14/25,5 = 0,549)
  - Pro Kalenderwoche separat betrachten!

PRO KALENDERWOCHE:
  Ist_diese_Woche = tatsächlich erteilte Unterrichtsstunden in KW
  Soll_diese_Woche = individuelle Wochenpflichtstunden

  Mehrarbeit_TZ = MAX(0, Ist_diese_Woche - Soll_diese_Woche)

  WENN Ist_diese_Woche >= Vollzeit-Soll:
    → Überschuss über Vollzeit: gilt als VOLLZEITMEHRARBEIT
    → Wird separat akkumuliert

MONATLICHE AGGREGATION TEILZEIT:
  Summe_TZ_Mehrarbeit = Summe aller KW-Mehrarbeiten (unterhalb Vollzeit)
  Bagatellgrenze_TZ = 3 × Teilzeit-Anteil

  WENN Summe_TZ_Mehrarbeit <= Bagatellgrenze_TZ:
    → Keine Vergütung (auch nicht für geleistete Stunden)
  SONST:
    → Vergütung = Summe_TZ_Mehrarbeit × anteilige_Vergütungsbasis

MONATLICHE AGGREGATION VOLLZEITMEHRARBEIT (falls angefallen):
  → Separate Berechnung wie Vollzeitlehrkraft (3-Stunden-Bagatellgrenze)

WICHTIG: Freisetzungen bei Teilzeit erst ab Vollzeitgrenze negativ werten!
```

---

### 3.3 Untis-Datenbankstruktur: Relevante Tabellen und Felder

```sql
-- LEHRERSTAMMDATEN (relevant für LBV-Mehrarbeit)
-- Quelle: Untis GPN-Datei oder Multi-User-Datenbank

Tabelle: LEHRER
  ID                    -- Interner Untis-Key
  Kürzel                -- z.B. "Mül" (Pflichtfeld, max. 5 Zeichen)
  Nachname              -- Vollständiger Nachname
  Vorname               -- Vorname
  Geburtsdatum          -- Für Altersermäßigung relevant
  Statistik             -- KRITISCH: "L", "P", "U", "B" + ggf. ", T" für Teilzeit
  Personal-Nummer       -- LBV-Personalnummer (im Feld "Pers.-Nr.")
  Stundensatz           -- Vergütungsschlüssel 1–4 (im Feld "Std.satz")
  Wochenstunden_Soll    -- Individuelle Pflichtstunden (aus UVD)
  Eintrittsdatum        -- Relevant für partielle Monate
  Austrittsdatum        -- Relevant für partielle Monate

Tabelle: VERTRETUNG
  Datum                 -- Datum der Vertretung
  Stunde                -- Unterrichtsstunde (1-N)
  Lehrer_Vertreter      -- FK auf LEHRER.ID (wer hat vertreten)
  Klasse                -- Vertretene Klasse
  Fach                  -- Unterrichtsfach
  Wert                  -- Wertigkeit (0 = nicht gezählt, 1 = normal, etc.)
  Art                   -- "V" = Vertretung, "F" = Freisetzung, "-F" = Entfall
  Grund                 -- Absenzgrund des ausgefallenen Lehrers
  Statistik-Kz.         -- Sondereinsatz-Code 0-8 (UntStat-relevant)

Tabelle: ABSENZ
  Lehrer_ID             -- Wessen Absenz
  Datum_von             -- Beginn
  Datum_bis             -- Ende
  Grund                 -- Absenzgrund (muss UntStat-Zuordnung haben)
  Art                   -- Ob anrechenbar oder nicht
```

---

### 3.4 Konfigurationsparameter im PEDAV-Tool (Claude Code muss kennen)

| Parameter | Pfad im Tool | Beschreibung | Standardwert |
|-----------|-------------|-------------|-------------|
| `Minutenmodell` | Optionen → LBV-Konverter | Unterrichtsdauer in Minuten | 45 |
| `Wochenstundensoll` | Optionen → LBV-Konverter | Vollzeit-Deputat für TZ-Berechnung | Schulformabhängig |
| `Betreuungen_als_Vertretung` | Optionen → LBV-Konverter | Betreuungsstunden zählen | false |
| `Freisetzungswert` | Optionen → LBV-Konverter | Vertretungswert statt Unterrichtswert | false |
| `Startmonat` | LBV-Mehrarbeitsdruck | Erster Monat der Abrechnung | aktueller Monat |
| `Anzahl_Monate` | LBV-Mehrarbeitsdruck | Wie viele Monate | 1 |
| `Export-Pfad` | Optionen → LBV-Konverter | Speicherpfad für PDFs | OneDrive/PEDAV |

---

### 3.5 Validierungsregeln für Claude Code

#### Pflicht-Validierungen vor jeder Berechnung:

```python
VALIDIERUNGEN = [
    {
        "id": "VAL-001",
        "prüfung": "Statistik-Kz nicht leer",
        "feld": "LEHRER.Statistik",
        "fehlertyp": "FEHLER",
        "meldung": "Keine LBV-Abrechnung ohne Rechtsverhältnis-Kz."
    },
    {
        "id": "VAL-002",
        "prüfung": "Personal-Nummer vorhanden",
        "feld": "LEHRER.Personal-Nummer",
        "fehlertyp": "FEHLER",
        "meldung": "LBV kann Lehrkraft nicht zuordnen"
    },
    {
        "id": "VAL-003",
        "prüfung": "Stundensatz 1–4",
        "feld": "LEHRER.Stundensatz",
        "fehlertyp": "FEHLER",
        "meldung": "Vergütungsschlüssel muss 1, 2, 3 oder 4 sein"
    },
    {
        "id": "VAL-004",
        "prüfung": "Wochenstundensoll > 0",
        "feld": "LEHRER.Wochenstunden_Soll",
        "fehlertyp": "FEHLER",
        "meldung": "Pflichtstundensoll fehlt in der UVD"
    },
    {
        "id": "VAL-005",
        "prüfung": "Vertretungswert != 0 (wenn Mehrarbeit erwartet)",
        "feld": "VERTRETUNG.Wert",
        "fehlertyp": "WARNUNG",
        "meldung": "Wert 0 = Stunde wird nicht vergütet"
    },
    {
        "id": "VAL-006",
        "prüfung": "Teilzeit-Parsing: ', T' in Statistik-Kz.",
        "feld": "LEHRER.Statistik",
        "fehlertyp": "INFO",
        "meldung": "Teilzeitlehrkraft: andere Berechnungslogik"
    },
    {
        "id": "VAL-007",
        "prüfung": "Mehrarbeit <= 24 Stunden/Monat (Vollzeit)",
        "berechnet": true,
        "fehlertyp": "WARNUNG",
        "meldung": "Vergütungsobergrenze überschritten, nur 24 Std. vergütbar"
    },
    {
        "id": "VAL-008",
        "prüfung": "Jahresgrenze <= 288 Stunden",
        "berechnet": true,
        "fehlertyp": "WARNUNG",
        "meldung": "Jahresobergrenze MVergV § 3 Abs. 2 beachten"
    }
]
```

---

### 3.6 Stundensatz-Zuordnung für CREDO-Schulen (Freie Evangelische Schulen Minden)

Basierend auf dem Schulprofil CREDO Gruppe / FES Minden:

| Schulform | Schulkürzel Untis | Pflichtstunden VZ | Erwarteter Stundensatz |
|-----------|------------------|--------------------|----------------------|
| Gymnasium FES | GY | 25,5 | 4 (höherer Dienst GY) |
| Gesamtschule | GE | 25,5 | 3 oder 4 (nach Laufbahn) |
| Grundschule FES | GS | 28,0 | 1 oder 2 |
| Berufskolleg FES | BK | 25,5 | 4 (höherer Dienst BK) |

---

### 3.7 Bekannte Fehlerquellen und Lösungsstrategien

#### Fehler 1: Bagatellgrenze-Neuberechnung bei Teilzeit
**Problem:** PEDAV-Tool möglicherweise auf alter Rechtslogik (ab 1. Stunde)
**Lösung:** Immer Gegenchecken: `Mehrarbeit_TZ < Bagatellgrenze_TZ → 0 €`
**Test-Query Untis:** Suche Lehrkräfte mit `Statistik LIKE '%T%'` und weniger als 3 × Teilzeitquote Vertretungsstunden im Monat → sollten 0 € ausweisen

#### Fehler 2: Wert-Feld = 0 bei Betreuungen
**Problem:** Untis schreibt 0 für Betreuungsstunden
**Lösung:** Vor LBV-Export prüfen: `SELECT * FROM VERTRETUNG WHERE Art='Betreuung' AND Wert=0`
**Eskalation:** Sekretariat / Schulleitung informieren, Werte korrigieren lassen

#### Fehler 3: Stille Fehler durch ungültige Anrechnungsgründe
**Problem:** Veraltete Codes (z.B. 280) werden vom Tool nicht zugeordnet
**Lösung:** Vor UVD-Export immer: PEDAV → Zuordnungen → Anrechnungsgründe prüfen

#### Fehler 4: Multi-User-Login schlägt still fehl
**Problem:** Kein Fehler, nur Passwortfeld geleert
**Lösung:** Nach Login-Versuch Datenstatus prüfen (Lehrerliste geladen?)

#### Fehler 5: Falsche Schulform → falsche Pflichtstunden
**Problem:** Untis-Schulform-Kürzel nicht korrekt → falsches Pflichtstundensoll
**Lösung:** Schulform-Kürzel gegen BASS-Liste validieren (s. Tabelle 1.2)

---

### 3.8 Anwendungsbeispiele zur Berechnungsvalidierung

#### Beispiel A — Vollzeitlehrkraft Gymnasium, Klasse L (Beamter auf Lebenszeit)
```
Schulform: GY | Pflichtstunden VZ: 25,5
Statistik: L | Stundensatz: 4
Monat: Oktober 2025

IST-Stunden:        28,5 (laut Untis Vertretungsplanung)
Ausfallstunden:      0,0 (keine Krankheit etc.)
Freisetzungen:       1,0
Entfälle:            0,0

Netto-IST:          28,5 + 0,0 = 28,5
Mehrarbeit_brutto:  28,5 - 25,5 = 3,0
Mehrarbeit_netto:    3,0 - 1,0 = 2,0

PRÜFUNG: 2,0 < 3 (Bagatellgrenze) → KEINE VERGÜTUNG
```

#### Beispiel B — Vollzeitlehrkraft Gymnasium, 4,5 Mehrarbeit netto
```
Mehrarbeit_netto: 4,5 Stunden

PRÜFUNG: 4,5 >= 3 → Vergütung für alle 4,5 Stunden
Betrag: 4,5 × Stundensatz-4 (~38 €) ≈ 171 € brutto
Kennzeichen: 'V' (Oktober 2025)
```

#### Beispiel C — Teilzeitlehrkraft 60%, GY, neu ab 07.06.2025
```
Schulform: GY | Pflichtstunden VZ: 25,5 | TZ-Quote: 60%
Individuelle Pflichtstunden: 25,5 × 0,60 = 15,3 Std./Woche
Bagatellgrenze_TZ: 3,0 × 0,60 = 1,8 Stunden

KW 41: IST=17,0 → Mehrarbeit_TZ = 17,0 - 15,3 = 1,7 (keine VZ-Mehrarbeit, da 17,0 < 25,5)
KW 42: IST=15,3 → Mehrarbeit_TZ = 0,0
KW 43: IST=16,0 → Mehrarbeit_TZ = 0,7

Summe_TZ_Mehrarbeit (Monat) = 1,7 + 0,0 + 0,7 = 2,4

PRÜFUNG: 2,4 > 1,8 (Bagatellgrenze überschritten) → VERGÜTUNG für 2,4 Stunden
Basis: anteilige Vergütung (nicht voller Stundensatz)
```

#### Beispiel D — Teilzeitlehrkraft erreicht Vollzeit in einer KW
```
KW 44: IST=27,0 → Pflichtstunden erreicht (27,0 > 25,5)
  → Teilzeitmehrarbeit: 25,5 - 15,3 = 10,2 Std. (bis Vollzeit)
  → Vollzeitmehrarbeit: 27,0 - 25,5 = 1,5 Std. (über Vollzeit)

AUSGABE: Übersichtsliste zeigt zwei Werte:
  TZ-Mehrarbeit: 10,2 Std. (monatlich kumuliert mit anderen KW)
  VZ-Mehrarbeit: 1,5 Std. (monatlich kumuliert)

HINWEIS: Freisetzungen in KW 44 werden erst nach Vollzeitgrenze negativ bewertet
```

---

### 3.9 Änderungshistorie und Versionierung

| Datum | Änderung | Rechtsquelle |
|-------|----------|-------------|
| 07.06.2025 | Bagatellgrenze für TZ-Lehrkräfte eingeführt | § 61 Abs. 1 LBG NRW n.F. |
| 01.02.2025 | Vergütungssätze angepasst | BASS 21-22 Nr. 22, MBl. NRW 2024 S. 1014 |
| 01.11.2024 | Vergütungssätze angepasst | LBesG NRW Anpassung |
| 01.08.2004 | Aktuelle Pflichtstundentabelle eingeführt | VO zu § 93 Abs. 2 SchulG |

---

### 3.10 Quellen und Referenzlinks

| Quelle | URL / Fundstelle |
|--------|-----------------|
| BASS 21-22 Nr. 21 (Mehrarbeit Schuldienst) | https://bass.schule.nrw/1056.htm |
| BASS 21-22 Nr. 22 (Vergütungssätze) | https://bass.schule.nrw/1057.htm |
| BASS 11-11 Nr. 1 (Pflichtstunden VO) | https://bass.schule.nrw/6218.htm |
| § 61 LBG NRW | https://recht.nrw.de (LBG) |
| PhV NRW: Bagatellgrenze 2025 | https://phv-nrw.de/2026/05/12/bagatellgrenze/ |
| GEW NRW: Mehrarbeit Teilzeit | https://www.gew-nrw.de/mehrarbeit-teilzeit |
| VBE NRW: Update Bagatellgrenze | https://vbe-nrw.de/mehrarbeit-teilzeitbeschaeftigung |
| PEDAV Untis-Tool 365 Handbuch | (Interne Dokumentation, Version 2026) |

---

## ZUSAMMENFASSUNG: Was Claude Code wissen muss

### Checkliste vor jeder LBV-Abrechnung

```
[ ] 1. Untis-Datenbank erfolgreich eingelesen (Multi-User-Login validieren!)
[ ] 2. Alle Lehrkräfte haben Statistik-Kz., Personal-Nr. und Stundensatz
[ ] 3. Wochenstundensoll konfiguriert (schulformgerecht)
[ ] 4. Minutenmodell geprüft (45 Minuten Standard?)
[ ] 5. Betreuungswerte in Untis ≠ 0 (falls relevant)
[ ] 6. Anrechnungsgründe alle zugeordnet (kein 280 oder veralteter Code)
[ ] 7. Abrechnungszeitraum korrekt (Startmonat, Anzahl Monate)
[ ] 8. Teilzeitloga: ab 07.06.2025 neue Bagatellgrenze anwenden
[ ] 9. VZ-Obergrenze: max. 24 Std./Monat, 288 Std./Jahr
[ ] 10. PDF-Export-Pfad vorhanden und beschreibbar
```

### Drei Grundsätze (nie vergessen)

1. **Verrechnungszeitraum:** Vollzeit = Monat | Teilzeit = Woche
2. **Bagatellgrenze:** Vollzeit = 3 Std. fest | Teilzeit = 3 × Teilzeitquote (seit 07.06.2025)
3. **Freisetzungen:** Bei Teilzeit erst negativ ab Vollzeitgrenze — vorher nur verrechnen, nicht abziehen

---

*Dokument erstellt durch CREDO-Drei-Agenten-System. Letzte Überprüfung: 17.06.2026.*
*Alle Angaben nach bestem Wissen und Gewissen — keine Rechtsberatung. Bei Zweifeln: Schulrechtsanwalt oder LBV direkt.*
