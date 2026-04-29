# Phase-2-Übergabe — Periodenmodell live

> **Stand:** 2026-04-29 · **Version:** v0.7 lokal · **Konzept:** v0.4
> **Briefing für nächste Session** — alles, was nötig ist, um sofort weiterarbeiten zu können.

---

## 1. Was ist fertig

### Datenmodell (Migrationen 0008–0010)
- **`untis_terms`** — Master-Periodendaten aus Untis (1:1 Spiegel der Untis-`Terms`-Tabelle, pro `(school_year_id, term_id)` eine Zeile mit `date_from`, `date_to`, `is_b_period`).
- **`deputat_pro_periode`** — Lehrer-Werte pro Untis-Periode (1 Zeile pro `(lehrer × sy × term)`, mit `gueltig_von/bis`-Cache).
- **`deputat_aenderung_korrekturen`** — Sachbearbeiter-Korrektur des Wirksamkeitsdatums (Untis erlaubt nur Montag, real auch andere Tage).
- **3 Views:**
  - `v_deputat_pro_tag` — pro Tag der gültige Wert (mit Fortschreibung in Lücken + Korrektur-Layer)
  - `v_deputat_monat_tagesgenau` — Aggregat pro Monat (gewichtet über alle Kalendertage)
  - `v_deputat_aenderungen` — echte Wertwechsel zwischen aufeinanderfolgenden Perioden, joined die Korrekturen

### Endpoints
- **`POST /api/untis-terms/sync`** — Spiegel der Untis-`Terms`-Tabelle (Voraussetzung für sync-v2)
- **`POST /api/deputate/sync-v2`** — Lehrer-Werte pro Periode (kein Coverage-Tie-Breaker mehr)
- **`GET /api/export/lehrer-detail?lehrerId=X&hj=Y`** — DIN-A4-Detail-PDF als Bezirksregierungs-Nachweis

### UI
- **Detailseite (`/deputate/[id]`)** — auf Periodenmodell umgestellt:
  - „Periodenmodell"-Card mit echten Wertwechseln (mit Inline-Edit für tatsächliches Datum) + ausklappbarem Periodenverlauf
  - „Monatliche Deputatsverteilung" zeigt tagesgenaue Werte mit `*`-Marker
  - „Taggenaue Deputatsberechnung (§ 3 Abs. 1 FESchVO)"-Card mit Aufschlüsselung pro Monat
  - „Als PDF (Nachweis)"-Button oben rechts
  - Alte `AenderungsHistorie`-Card entfernt
- **Mitarbeiter-Liste (`/mitarbeiter`)** — pro Lehrer-Zeile „📄 PDF"-Pill
- **Deputate-Übersicht (`/deputate`)** — Sortierung **Schule → Beamte → Angestellte → Name**, 2 Nachkommastellen
- **Excel-/PDF-Export Deputate** — analog: pro Schule Sub-Header *„Beamte (n)"* / *„Angestellte (n)"*, 2 NK

### Berechnung
- **Stellen-IST-Action** auf Periodenmodell umgestellt — der gesamte alte `berechneTagesgenauKorrekturen`-Block ist weg, die View liefert die Wahrheit
- `details.modell = "periodenmodell-v0.7"` im JSON-Audit-Trail jeder Berechnung

### Wichtige Architektur-Entscheidungen
| # | Frage | Entscheidung |
|---|---|---|
| 1 | Juli rechnen | Volle 31 Kalendertage (gleiche Logik in jedem Monat) |
| 2 | Sommerferien-Lücke | Letzten bekannten Wert fortschreiben |
| 3 | Endpoint-Strategie | Neuer `sync-v2` parallel zum alten `sync` |
| 4 | `deputat_monatlich` | Bleibt vorerst (parallel beschrieben) — Phase 3 ersetzt durch Materialized View |
| 5 | Korrektur-Layer | Eigene Tabelle, getrennt vom Untis-Spiegel |
| 6 | Nachkommastellen | 2 (statt 1) durchgängig |

---

## 2. Lokaler Test-Stand

| Metrik | Wert |
|---|---|
| Lehrer | 96 (aus `C:/Users/driesen.FES/Downloads/lehhrer.txt`, beide SY backfilled) |
| `untis_terms` | 34 (16× SY 2024/25, 18× SY 2025/26) |
| `deputat_pro_periode` | 2858 |
| Echte Wertwechsel (`v_deputat_aenderungen`) | 144, davon 112 gehaltsrelevant |
| Lokale Korrekturen | 1 (Bergmann T10→T11 auf Mi 04.02. — Test-Eintrag) |

**Verifikate:**
- **Bergmann Benjamin** (lehrer_id 81, GYM): 4 echte Wertwechsel, Februar 16,25 (mit Korrektur) statt 17,0 pauschal
- **Diercks Daniel** (lehrer_id 5, BK): Februar 24,57 (tagesgenau) statt 25,0 pauschal — UI und PDF identisch

**Container:** `hr_stellen_ist_berechnung-db-1` läuft auf Port 5450 (siehe `.env`).
**Dev-Server:** `npm run dev` → `http://localhost:3001`.

---

## 3. Was noch offen ist

### Sofort umsetzbar (klein)
- **Massen-PDF**: ein Klick liefert alle Lehrer einer Schule als ein PDF (oder ZIP). Endpoint-Pattern: `/api/export/lehrer-detail-massen?schuleId=X&hj=Y` — iteriert über `getAlleLehrerMitDetails` (gefiltert) und hängt PDFs aneinander mit `doc.addPage()` zwischen den Lehrern. Button in `/deputate` (pro Schul-Header) und/oder in `/mitarbeiter` (Schul-Filter).

### Phase 3 — Cleanup (mittel)
- Alten v1-Sync (`/api/deputate/sync`) deprecaten — sobald n8n auf v2 umgestellt ist
- `deputat_aenderungen` Tabelle archivieren (nur noch v_deputat_aenderungen lesen)
- `deputat_monatlich` als Materialized View über `v_deputat_monat_tagesgenau`
- `berechneTagesgenauKorrekturen`/`getAenderungenMitDatum`/`getPauschaleDeputateByLehrer` aus `queries.ts` entfernen (heute nicht mehr aufgerufen)
- Andere Aufrufer von `berechneLehrerDeputatEffektiv` mit dem alten Modell sind keine mehr da — alle 4 Aufrufer (Detailseite, Mitarbeiter, Deputate, Export) sind umgestellt. Die alte Funktion akzeptiert weiter den alten Adapter-Stil und ist somit kompatibel.

### n8n-Integration (extern)
- Workflow #223 erweitern um zwei neue Schritte:
  1. Untis-`Terms`-Query → POST `/api/untis-terms/sync`
  2. Lehrer-Query → POST `/api/deputate/sync-v2` (statt `/sync`)
- Detail in `docs/deployment/n8n_workflow_v0.6.0.md` (muss noch um Periodenmodell ergänzt werden — oder neue Datei `n8n_workflow_v0.7.md`)

### Detail-Polish (klein)
- DIN-A4-PDF: Beim Bergmann-Test sah das Layout gut aus, bei Diercks ggf. nochmal querprüfen ob alle Werte stimmen
- Tagesgenau-Card auf der Detailseite zeigt Pauschal/Effektiv aus dem alten `deputat_monatlich` als „Pauschal" — funktioniert, könnte aber auf den dominanten Term-Wert aus `v_deputat_monat_tagesgenau.dominante_term_id` umgestellt werden für volle Konsistenz mit Phase 3

---

## 4. Code-Wegweiser für die nächste Session

**Pure Helper / Logik:**
- `src/lib/berechnungen/deputatEffektiv.ts` — `berechneLehrerDeputatEffektiv` + neuer Adapter `adaptiereEchteAenderungen`
- `src/lib/statistikCode.ts` — `gruppenSortRank`, `gruppenLabel`, `vergleicheLehrerNachSchuleGruppeName`

**Queries:**
- `src/lib/db/queries.ts` — neu: `getEchteAenderungenAlleLehrer`, `getDeputatSummenBySchuleTagesgenau`, `getLehrerPeriodenverlauf`, `getLehrerEchteAenderungen`, `getLehrerTagesgenauMonate`

**UI-Komponenten:**
- `src/app/deputate/[id]/PeriodenModellCard.tsx` — Client-Komponente, „Echte Wertwechsel" mit Inline-Edit + Periodenverlauf
- `src/app/deputate/actions.ts` — `korrigierePeriodeWirksamkeitAction` + `loescheKorrekturAction`

**Sync-Endpoints:**
- `src/app/api/untis-terms/sync/route.ts`
- `src/app/api/deputate/sync-v2/route.ts`

**Export:**
- `src/app/api/export/lehrer-detail/route.ts` — DIN-A4-Detailseiten-PDF (Hochformat, A4)
- `src/app/api/export/deputate/route.ts` — Excel/PDF-Übersicht mit Schule → Gruppe → Name

**Schema:**
- `src/db/schema.ts` — neu: `untisTerms`, `deputatProPeriode`, `deputatAenderungKorrekturen`
- `src/db/migrations/0008_deputat_pro_periode.sql`, `0009_view_pro_tag_range.sql`, `0010_korrektur_layer.sql`

**Test-Skripte:**
- `scripts/test-bergmann-v2.mjs` — kleiner Verifikat-Run für Bergmann
- `scripts/backfill-v2-from-lehhrer-txt.mjs` — Backfill aus dem lokalen JSON-Dump

**Verifikations-SQL:**
- `docs/bergmann_v2_check.sql` — alle drei Sektionen (Periodenwerte, echte Wertwechsel, Tagesgenau) für Bergmann

---

## 5. Ausgangspunkt für die nächste Session

Wenn du **Massen-PDF** als nächstes willst:
1. Lies `src/app/api/export/lehrer-detail/route.ts` als Vorlage
2. Neue Route `/api/export/lehrer-massen/route.ts` — gleicher Aufbau, aber Schleife über mehrere Lehrer mit `doc.addPage()` zwischendurch
3. Filter-Param `schuleId` + optional `nurAktiv=true`
4. Buttons in `/deputate` (pro Schul-Header) oder `/mitarbeiter` (über dem Filter-Bereich)

Wenn du **Phase 3 Cleanup** als nächstes willst:
1. Erst n8n auf v2 umstellen (real-Daten-Test in Prod)
2. Erst danach Code-Removal — sonst riskierst du Datenlücken in der Übergangszeit

**Empfehlung:** Erst Massen-PDF (klein, sichtbarer Nutzen, kein Risiko), dann n8n-Umstellung, dann Phase 3.
