# Mehrarbeit / Vertretungs-Controlling → Stellenanteil
### Prüf- und Umsetzungspaket · Schuljahr 2025/2026

**Stand:** 16.07.2026 · CREDO Gruppe / Freie Evangelische Schulen Minden
**Kontext:** Automatische Ermittlung der übernommenen Vertretungen (Mehrarbeit) aus Untis und Einspeisung als **Stellenanteil** in die App `HR_Stellen_Ist_Berechnung` — Grundlage für die Refinanzierungsnachweise gegenüber der Bezirksregierung NRW (§§ 105 ff. SchulG).

---

## 1 · Inhalt dieses Ordners

| Datei | Zweck |
|---|---|
| **Untis_Mehrarbeit_Datenpruefung_SJ2025-2026.xlsx** | Prüf- & Bestätigungsmappe (12 Blätter) mit echten Daten SJ 2025/2026. Grün = Vorschlag zum Bestätigen, blau = aus NRW-Rechtsdoku, gelb = offen. |
| **Plan_Mehrarbeit_Stellenanteil.html** | Umsetzungsplan im CREDO-CI: Datenfluss, Zähl-Regeln, Berechnungsweg **mit Beispiel** und **Mockup** der Stellenist-Ansicht. |
| **Mail_Pruefbitte_Mehrarbeit_2026-07-16.md** | Anschreiben an Untis-Experte · Personalsachbearbeitung · Geschäftsführung (Warum/Stakes + rollenspezifische Bitte). |
| **Mail_an_Untisexperte_2026-07-15.md** | Ursprüngliches, technisch fokussiertes Anschreiben nur an den Untis-Experten. |
| **build_workbook.ps1** | Erzeugt die Excel-Mappe reproduzierbar via Excel-COM (PowerShell). Alle Zahlen aus DAX-Abfragen. |
| **data_sample.csv** | Datenquelle für Blatt „09_Beispielzeilen" (UTF-8, echte Vertretungszeilen mit Kürzeln). |
| **README.md** | Diese Übersicht. |

---

## 2 · Kernbefunde (verifiziert, SJ 2025/2026, `SCHOOLYEAR_ID 20252026`)

Quelle: lokales Power-BI-Modell „Untis Alle Tabellen" (57 Tabellen), abgefragt per DAX; `Deleted = FALSE`.

- **6.408** übernommene Vertretungen (`TEACHER_IDSubst > 0`) von 13.196 `Substitution`-Zeilen.
- **`SubstValue` zu 97 % leer** → jede vertretene Stunde wird gezählt (1 Zeile = 1 Std.), nicht summiert. Laut NRW-Rechtsdoku: `Wert 0 = nicht gewertet` → „0"-Zeilen ausschließen.
- **`BookingType` durchgängig 0** → trägt keine Information; Klassifikation steckt komplett im String **`Flags`** (F = Freisetzung, E = Entfall, L = echte Vertretung u. a.).
- **`Absence.TypeA` 101** dominiert (2.667), davon **55 % ohne Grund** — Kernfrage Freisetzung vs. Pflegelücke.
- Auszuschließen: **Selbstvertretung** (`IDSubst = IDLessn`), **Events** ohne Ausfall-LK (`IDLessn = 0`, z. B. „Zeugnisausgabe"), **Steuergründe** (`fnz`, `KV`, `BE-V`, `KOR-V`).

### Durch die NRW-Rechtsdoku geklärt
- **`Teacher.SalaryPeHour` = Vergütungsschlüssel × 100** (200 → Schlüssel 2, 400 → Schlüssel 4; frühere 100 → Schlüssel 1). Rechtsdoku 1.6.
- **Rechtsverhältnis** (Beamter/Angestellter) steht in **`Teacher.StatisticCodes`** (L/P/U/B, „T" = Teilzeit) — nicht in `Status`. Live bestätigt.
- **Anrechnungscode 280** offiziell entfallen (Rechtsdoku 2.3/3.7).
- **Bagatellgrenze** (3/24/288 Std.) betrifft nur den Euro-/Vergütungs-Pfad, **nicht** das Stellenist → fürs Stellenist zählen alle Stunden.

---

## 3 · Offene Bestätigungen (in der Excel, gelb/grün)

- **Untis-Experte:** exakte `Flags`-Decodierung, `BookingType`, `SubstValue`/Wert-Semantik, `TypeA` 100/101/102, Dauer- vs. Tagesvertretung.
- **Personalsachbearbeitung:** Grund-Mapping (refinanzierbar vs. Steuergrund), Vollständigkeit der Erfassung je Schule.
- **Geschäftsführung:** Freigabe „alle Stunden ohne Bagatellgrenze fürs Stellenist", Verantwortlichkeit für die Gründe-Pflege.

---

## 4 · Nächste Umsetzungsschritte (nach Bestätigung)

A. Migration `0016` — Feld `quelle` in Tabelle `mehrarbeit` + Upsert-Schutz für manuelle Einträge.
B. Grund-Mapping-Tabelle final (aus Blatt 06).
C. Aggregations-View `v_mehrarbeit_untis_monat` (zählbare Std. je Lehrkraft/Monat/Schule).
D. Sync-Endpoint `/api/mehrarbeit/sync` + n8n (analog `deputate/sync-v2`).
E. Anzeige & Drilldown (Mehrarbeit getrennt ausgewiesen, Untis-Kennzeichnung).
F. Validierung gegen Referenzlehrkräfte / LBV-Bogen.

Berechnung (Kern): `Stellenanteil = Vertretungsstunden / (Monate × Regeldeputat)`, getrennt Jan–Jul (÷7) und Aug–Dez (÷5), zum Jahr gewichtet `(·7 + ·5)/12`; addiert zum Basis-Stellenist. Details siehe `Plan_Mehrarbeit_Stellenanteil.html`.

---

## 5 · Excel reproduzieren

Voraussetzung: Windows mit installiertem **Microsoft Excel** (COM). Kein Python/Node nötig.

```powershell
& ".\build_workbook.ps1"
```

Das Skript liest `data_sample.csv` (UTF-8) und schreibt `Untis_Mehrarbeit_Datenpruefung_SJ2025-2026.xlsx`. Die aggregierten Kennzahlen (Flags, Gründe, TypeA, SalaryPeHour, CV_Reason) sind im Skript als Ergebnis der DAX-Abfragen hinterlegt.

---

## 6 · Datenschutz-Hinweis

`data_sample.csv` und die `.xlsx` enthalten **echte Lehrer-Kürzel, Klassen und Abwesenheitsgründe** (personenbeziehbare Daten). Vor einer Veröffentlichung oder Weitergabe außerhalb der berechtigten Stellen ist zu prüfen, ob eine Anonymisierung nötig ist (DSGVO).

**Im Git-Repository ausgeschlossen:** `Untis_Mehrarbeit_Datenpruefung_SJ2025-2026.xlsx` und `data_sample.csv` sind per `.gitignore` von der Versionierung ausgenommen und werden **nicht** nach GitHub gepusht. Sie liegen nur lokal vor und werden ausschließlich per Mail an die berechtigten Stellen weitergegeben. Wer das Repo klont, muss `data_sample.csv` aus Untis neu erzeugen, bevor `build_workbook.ps1` das Blatt „09_Beispielzeilen" wieder aufbauen kann.
