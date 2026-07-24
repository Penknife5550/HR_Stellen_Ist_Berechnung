# Untis-Datenmodell, Mehrarbeit und Stellenanteile — Erkenntnis-Dokumentation

> **Zweck:** Saubere, quellenbasierte Grundlage dafür, wie aus den Untis-Daten
> (Power-BI-Bericht „Untis Alle Tabellen") **Mehrarbeit** ermittelt und in
> **Stellenanteile** für die App `HR_Stellen_Ist_Berechnung` überführt wird.
> **Kontext:** CREDO Gruppe / FES, NRW-Ersatzschulfinanzierung, Bezirksregierung.
> **Stand:** 2026-06-17 | Schuljahr 2025/2026.
> **Quellen:** Power-BI-Modell „Untis_Alle_Tabellen_Mehrarbeit" (live geprüft),
> `mehrarbeit_nrw_rechtsdokumentation.md`, `vergütungsstufen_mehrarbeit_nrw.md`,
> Repo `HR_Stellen_Ist_Berechnung` (Code gelesen).

---

## 0. Die zentrale Einsicht zuerst

Für **Stellenanteile** zählt **nur die Mehrarbeit in Stunden** — der
Vergütungsschlüssel (Euro) ist hier irrelevant. Aus denselben Mehrarbeitsstunden
entstehen zwei getrennte Auswertungen:

| Output | Empfänger | Formel | Schlüssel/Euro nötig? |
|---|---|---|---|
| **Stellenanteil** | Bezirksregierung (Refinanzierung) | `Stunden / (Monate × Regeldeputat)` | **nein** |
| **Vergütung** | LBV (Mehrarbeitsvergütung) | `Stunden × Stundensatz(Schlüssel)` | ja |

Dieses Dokument betrifft den **linken** Pfad. Der rechte (Euro, `SalaryPeHour`,
BASS-Sätze) ist in `mehrarbeit_verguetung_postgres.sql` umgesetzt und läuft parallel.

---

## 1. Was der Power-BI-Bericht „Untis Alle Tabellen" wirklich ist

- **Natives Untis-Schema**, 57 Tabellen mit englischen Originalnamen — **nicht**
  das idealisierte PEDAV-Modell (`LEHRER`/`VERTRETUNG`/`ABSENZ`) aus der
  Rechtsdoku. Die Rechtsdoku beschreibt die *Soll-Logik*, die echten Tabellen
  heißen anders.
- **Mehrarbeit ist kein fertiges Feld.** Untis speichert Vertretungen, Werte und
  Anrechnungen; die Mehrarbeit ist eine *abgeleitete* Größe, die erst berechnet
  werden muss.

### 1.1 Relevante Tabellen (datenseitig verifiziert)

| Zweck | Untis-Tabelle | Schlüsselfelder |
|---|---|---|
| Lehrerstammdaten | `Teacher` | `TEACHER_ID`, `Name` (Kürzel), `Longname`, `FirstName`, `PNumber` (LBV-Pers-Nr.), `StatisticCodes` (Rechtsverhältnis), `SalaryPeHour`, `PlannedWeek` (Soll ×1000), `BirthDate`, `ArrivalDate`/`DepartureDate` |
| **IST-Quelle Mehrarbeit** | `Substitution` | `Date`, `Lesson` (Stunde), `TEACHER_IDSubst` (Vertreter), `TEACHER_IDLessn` (Ausfall), `SUBJECT_IDSubst`, `SubstValue` (Wertigkeit), `Flags`/`BookingType` (Art), `ClassIds`, `AbsenceIds` |
| Absenzen | `Absence` + `AbsenceReason` | `IDA`/`TypeA`, `DateFrom`/`DateTo`, `ABSENCE_REASON_ID`, `ValueDeduction`, `AbsenceReason.StatisticCodes` |
| Anrechnungen/Ermäßigungen | `CountValue` + `CV_Reason` | `TEACHER_ID`, `Value`, `PercentValue`, `CV_REASON_ID`, `DateFrom`/`DateTo` |
| Zeitdimension | `Calendar`, `SchoolYear`, `Terms`, `Holiday` | Auflösung Untis-Datum → KW/Monat, Ferien/Feiertage |
| Dimensionen | `Subjects`, `Class`/`Classlevel`, `School`/`Department` | Fach, Klasse/Jahrgang, Schulform |

### 1.2 Verifizierte Fallstricke im Untis-Modell

1. **Skalierung ×1000:** `Teacher.PlannedWeek = 25500` bedeutet **25,5 Std.**
   Ob `Substitution.SubstValue` ebenfalls ×1000 ist, **muss vor Produktivlauf
   geprüft werden** (Prüf-Query: `SELECT DISTINCT SubstValue FROM Substitution`).
2. **`Teacher` ist versioniert** (`SCHOOLYEAR_ID`, `VERSION_ID`, `TERM_ID`): pro
   Lehrkraft mehrere Zeilen — ohne Filter auf die richtige Version verdoppeln
   sich Werte.
3. **Datumskodierung** der Untis-`Date`-Felder ist vor der Monatszuordnung zu
   verifizieren (YYYYMMDD-Integer vs. Tagesserial).
4. **`StatisticCodes`** trägt das Rechtsverhältnis (`L`, `P`, `A`, `U`, `B`, `W`)
   und das Teilzeit-Kennzeichen (Suffix `T`, z. B. `LT`, `BT`). Im Bestand auch
   leere / `_` / nur `T` — diese Lehrkräfte sind unvollständig gepflegt.
5. **`SalaryPeHour`** enthält im Bestand nur `{0, 200, 400}` — **nicht** 1–4.
   Nur für den Vergütungs-Pfad relevant, **für Stellenanteile ohne Bedeutung.**

---

## 2. Mehrarbeit fachlich — was zählt, was nicht

Rechtsrahmen: § 61 LBG NRW, MVergV, BASS 21-22 Nr. 21/22, für Ersatzschulen
§§ 105 ff. SchulG NRW. Details siehe `mehrarbeit_nrw_rechtsdokumentation.md`.

### 2.1 Zwei Quellen von Mehrarbeit — und die getroffene Entscheidung

- **Strukturelle Mehrarbeit (Plan/`Lesson`):** Lehrkraft ist im Stundenplan
  dauerhaft über Deputat verplant. **Ist bereits im Stellenist enthalten**, weil
  die App das (Perioden-)Deputat aus `Teacher`/Termen abbildet
  (`deputat_pro_periode`). Wird hier **nicht** erneut gezählt.
- **Vertretungs-Mehrarbeit (`Substitution`):** kurzfristige Mehrleistung über
  den Plan hinaus. **Dies ist die gewählte IST-Quelle** für den
  Mehrarbeits-Zuschlag auf das Stellenist.

> **Kein Doppelzählen:** Das Basis-Stellenist kommt aus dem Periodendeputat;
> `Substitution` liefert ausschließlich die *zusätzliche* Mehrarbeit obendrauf.

### 2.2 Was aus `Substitution` als Mehrarbeit zählt

- **Vertretung** durch die Lehrkraft (`TEACHER_IDSubst` = Lehrkraft) mit
  `SubstValue > 0`: **positiv**.
- **Freisetzung** (Lehrkraft wird freigestellt): im Vollzeitfall **negativ**
  (mindert Mehrarbeit).
- **Entfall** und nicht gewertete Zeilen (`SubstValue = 0`, z. B. Betreuung mit
  Default 0): **zählen nicht**.

> **Offen / zu verifizieren:** Die exakte Zuordnung der Art (Vertretung /
> Freisetzung / Entfall) zu `Substitution.Flags` bzw. `BookingType` muss am
> echten Datensatz bestätigt werden. Ohne das stimmt das Vorzeichen nicht.

### 2.3 Berechnungsregeln (aus der Rechtsdoku)

- **Bezugszeitraum:** Vollzeit = Kalendermonat · Teilzeit = Kalenderwoche.
- **Bagatellgrenze:** Vollzeit 3 Std./Monat · Teilzeit `3 × Teilzeitquote`
  (neu seit 07.06.2025, § 61 Abs. 1 LBG NRW n.F.).
- **Obergrenzen (nur Vergütung):** 24 Std./Monat, 288 Std./Jahr.

---

## 3. Vom Mehrarbeitsstunden-Wert zum Stellenanteil

Die App rechnet (Code: `src/lib/berechnungen/stellenist.ts`):

```
Stellenist(Zeitraum) = Σ Wochenstunden(Zeitraum) / (Monate × Regeldeputat)
   Jan–Jul: Monate = 7    Aug–Dez: Monate = 5
Mehrarbeit-Stellen(Zeitraum) = Σ Mehrarbeitsstunden(Zeitraum) / (Monate × Regeldeputat)
Jahreswert = (Gesamt_JanJul × 7 + Gesamt_AugDez × 5) / 12   → auf 1 Dezimalstelle gerundet
```

Damit ist der **Umrechner Stunden → Stellenanteil bereits vorhanden.** Eine
Mehrarbeitsstunde pro Monat über das Regeldeputat (z. B. 25,5) erzeugt den
Stellenanteil `1 / (Monate × 25,5)`.

### 3.1 Anschlussstelle in der App

Tabelle `mehrarbeit` (zwei Modi, per CHECK erzwungen):

| Modus | Felder | Verwendung |
|---|---|---|
| **Lehrer-bezogen** | `lehrer_id`, `haushaltsjahr_id`, `monat`, `schule_id`, `stunden` | **Hier dockt die Untis-Mehrarbeit an** (Stunden je Lehrkraft/Monat/Schule) |
| Schul-pauschal | `schule_id`, `monat`, `stellenanteil` (lehrer_id NULL) | manuelle Pauschale, fließt 1:1 in Stellen |

Heute wird der lehrer-bezogene Modus **manuell** über `/mehrarbeit`
(`saveMehrarbeit`) gepflegt. Ziel: **automatisch aus `Substitution` befüllen.**

### 3.2 Mapping Untis → App

| Untis | App |
|---|---|
| `Substitution.TEACHER_IDSubst` | `lehrer.untis_teacher_id` → `lehrer.id` |
| `Substitution.Date` → Monat/Jahr | `mehrarbeit.monat` + `haushaltsjahr_id` |
| Σ `SubstValue` (Vertretung − Freisetzung) je LK/Monat/Schule | `mehrarbeit.stunden` |
| Regeldeputat je Schulform | `regeldeputate.regeldeputat` |

---

## 4. Entscheidungspunkte für die Refinanzierung (bewusst offen)

1. **Bagatellgrenze beim Stellenist ja/nein?** Die 3-Std.-Grenze ist eine
   *Vergütungs*-Schwelle (ob gezahlt wird). Für das **Stellenist** zählt die
   tatsächlich geleistete Arbeit — die Grenze hier anzuwenden würde das
   Stellenist **kürzen** und Refinanzierung verschenken. **Empfehlung:** für
   Stellenanteile **alle** Mehrarbeitsstunden ohne 3-Std.-Floor und ohne
   24-Std.-Kappung ansetzen; Bagatellgrenze/Kappung nur im Vergütungs-Pfad.
   → **Fachliche Bestätigung nötig.**
2. **Schulzuordnung der Vertretung:** Zählt eine Vertretung zur Schule des
   *vertretenen Unterrichts* (`ClassIds`/`Department`) oder zur *Stammschule*
   der Lehrkraft? Beeinflusst das Stellenist **pro Schule**. → zu klären.
3. **Teilzeit-Wochenlogik:** Für vergütungskonforme Werte ist Teilzeit
   wochenweise zu betrachten. Für das Stellenist (Monats-/Jahresmittel) genügt
   i. d. R. die Stundensumme. Konsistenz zwischen beiden Pfaden festlegen.
4. **Skalierung `SubstValue` und Untis-`Date`-Kodierung** vor Produktivlauf
   verifizieren (siehe 1.2).

---

## 5. Quellen

- Power-BI-Modell „Untis_Alle_Tabellen_Mehrarbeit" (live abgefragt 2026-06-17).
- `mehrarbeit_nrw_rechtsdokumentation.md` (§ 61 LBG NRW, BASS 21-22 Nr. 21).
- `vergütungsstufen_mehrarbeit_nrw.md` (BASS 21-22 Nr. 22).
- Repo `HR_Stellen_Ist_Berechnung`: `src/lib/berechnungen/stellenist.ts`,
  `src/db/schema.ts` (`mehrarbeit`, `lehrer`, `regeldeputate`),
  Migrationen `0003`/`0004` (Mehrarbeit), `0008` (Periodenmodell).
