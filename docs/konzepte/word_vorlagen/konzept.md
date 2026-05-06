# Word-Vorlagen-Bibliothek — Konzept v1

> **Stand:** 2026-05-06 · **Status:** Plan, noch nicht implementiert
> **Zweck:** Hardcoded `.docx`-Templates durch DB-verwaltete Vorlagen ersetzen,
> Admin-UI fuer Upload/Verwaltung, dynamische Kategorien fuer kuenftige
> Use-Cases.

---

## 1. Ausgangslage (Status quo)

Aktuell existieren zwei Word-Generierungs-Pfade — beide mit fest verdrahteten
Template-Dateien im Filesystem:

| Use-Case | Endpoint | Generator | Template-Datei |
|---|---|---|---|
| Vertragsnachtrag | `/api/export/nachtrag` | `generateNachtragDocx()` | `src/lib/export/vorlagen/nachtrag-template.docx` |
| Antrag zusaetzliche Stellenanteile | `/api/export/stellenanteil-antrag` | `generateStellenanteilAntragDocx()` | `src/lib/export/vorlagen/stellenanteil-antrag-template.docx` |

Beide nutzen `docxtemplater` + `pizzip` + `docxtemplater-image-module-free`
und betten einen QR-Code als PNG ein. Die Daten-Bundles (Felder-Schemata)
sind als TypeScript-Interfaces hardcoded.

**Limitierung:** Templates koennen nur per Code-Deploy ausgetauscht werden.
HR/Admin haben keine Moeglichkeit, eine neue Vorlage hochzuladen.

---

## 2. Anforderungen (User-Antworten)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Mehrere Vorlagen pro Kategorie? | Ja — eine Standard-Vorlage, weitere Varianten waehlbar |
| 2 | Soft-Delete oder Hard-Delete? | Soft-Delete (`aktiv=false`) — Audit-Spur bleibt |
| 3 | Initial-Seed der bestehenden Templates? | Ja — uebernehmen aus `src/lib/export/vorlagen/` |
| 4 | Kategorien dynamisch per UI anlegen? | Ja — Admin kann neue Kategorien definieren |
| 5 | Sidebar-Position | Top-Level unter „Admin" |

---

## 3. Architektur-Konzept

**Eine Tabelle fuer Kategorien, eine fuer Vorlagen.** Eine Engine
(`renderVorlage()`) liest die Vorlage aus der DB, rendert sie mit den vom
Caller uebergebenen Daten und liefert einen Buffer zurueck. Admin-UI fuer
Upload, Verwaltung, Vorschau.

### 3.1 System- vs. User-Kategorien

Eine Kategorie ist nicht nur ein Name, sondern an einen **Use-Case mit
Datenquelle** gekoppelt:

- `nachtrag` → liest aus `v_deputat_aenderungen`, QR-Inhalt: `Vorname|Nachname|Personalnr`
- `stellenanteil_antrag` → liest aus `stellenanteile`, QR-Inhalt: `Schule|Stellenart|Wert|Datum|Aktenzeichen`

Diese sind **System-Kategorien** (`ist_system=true`). Sie sind im Code
referenziert und duerfen nicht geloescht oder umbenannt werden.

**User-Kategorien** koennen vom Admin per UI angelegt werden (z.B.
„versorgungsfall", „befoerderungsantrag"). Solange kein Render-Caller im
Code existiert, sind sie nur „stille" Vorlagen-Speicher: hochladen,
verwalten und per Vorschau (Dummy/JSON-Daten) rendern moeglich, aber kein
Production-Endpoint nutzt sie. Wenn ein neuer Use-Case relevant wird,
schreibt ein Entwickler einen Render-Caller — die Vorlage ist dann sofort
einsatzbereit.

### 3.2 Standard-Vorlage pro Kategorie

Pro Kategorie ist genau eine aktive Vorlage als **Standard** markiert.
DB-seitig erzwungen durch partiellen UNIQUE-Index
`WHERE ist_standard=TRUE AND aktiv=TRUE`. Bei Render ohne explizite
`vorlageId` wird die Standard-Vorlage genommen. Bei mehreren aktiven
Vorlagen einer Kategorie zeigt das UI ein Auswahl-Modal, sonst direkter
Download (heutiges Verhalten).

---

## 4. Datenmodell — Migration `0016_word_vorlagen.sql`

```sql
-- Kategorien (System + User-defined)
CREATE TABLE vorlagen_kategorien (
  id SERIAL PRIMARY KEY,
  schluessel VARCHAR(50) NOT NULL UNIQUE,        -- "nachtrag" (slug)
  bezeichnung VARCHAR(150) NOT NULL,             -- "Vertragsnachtrag"
  beschreibung TEXT,
  bekannte_felder JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["lehrerVollname",...]
  ist_system BOOLEAN NOT NULL DEFAULT FALSE,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vorlagen_kategorien_schluessel_format
    CHECK (schluessel ~ '^[a-z][a-z0-9_]{1,49}$')
);

INSERT INTO vorlagen_kategorien (schluessel, bezeichnung, ist_system, bekannte_felder) VALUES
  ('nachtrag', 'Vertragsnachtrag', TRUE,
   '["lehrerVollname","vorname","nachname","anrede","personalnummer","altStunden","neuStunden","regelstunden","schuleName","schulformLang","schulform","aenderungsDatum","geburtsdatum","geburtsort","adresse","vertragstyp","vertragsdatum","vonDatum","bisDatum","qrCode"]'::jsonb),
  ('stellenanteil_antrag', 'Antrag zusaetzliche Stellenanteile', TRUE,
   '["brBehoerde","brAnsprechpartner","brStrasse","brPlzOrt","absenderName","absenderTelefon","datum","betreffzeile","lehrerName","schuleName","schuleOrt","schulform","schuleStandort","schuljahr","antragText","stellenartBezeichnung","wert","aktenzeichen","qrCode"]'::jsonb);

-- Vorlagen
CREATE TABLE word_vorlagen (
  id SERIAL PRIMARY KEY,
  kategorie_id INTEGER NOT NULL REFERENCES vorlagen_kategorien(id),
  name VARCHAR(150) NOT NULL,
  beschreibung TEXT,
  dateiname VARCHAR(200) NOT NULL,
  dateigroesse_bytes INTEGER NOT NULL,
  inhalt BYTEA NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  platzhalter JSONB NOT NULL DEFAULT '[]'::jsonb,
  unbekannte_platzhalter JSONB NOT NULL DEFAULT '[]'::jsonb,
  ist_standard BOOLEAN NOT NULL DEFAULT FALSE,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  hochgeladen_von VARCHAR(100) NOT NULL,
  hochgeladen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX word_vorlagen_standard_unique
  ON word_vorlagen (kategorie_id)
  WHERE ist_standard = TRUE AND aktiv = TRUE;

CREATE INDEX idx_word_vorlagen_kategorie ON word_vorlagen (kategorie_id, aktiv);
```

### 4.1 Begruendungen

- **BYTEA in DB** statt Filesystem/S3: ~10 Vorlagen × ~200 KB = max. 2 MB
  DB-Wachstum, transaktional konsistent, automatisch im `pg_dump`.
  Filesystem wuerde bei Container-Re-Deploy verloren gehen (kein Volume-
  Mount aktuell). S3 = Overkill.
- **Keine separate History-Tabelle**: `audit_log` reicht. Versionierung
  spaeter nachruestbar.
- **`sha256`** dient als (1) Dedup-Key beim Upload, (2) Integritaets-Check
  beim Render falls die Datei korrupt aus DB kommt.
- **`platzhalter` als JSONB** wird beim Upload extrahiert und gespeichert →
  keine Re-Parse-Kosten beim Render, nutzbar fuer Admin-UI-Anzeige.
- **`unbekannte_platzhalter`**: Tags in der DOCX, die nicht im
  Kategorie-Schema (`bekannte_felder`) stehen. Werden beim Upload als
  Warnung angezeigt — kein Fail. Beim Render mit `_______` aufgefuellt.
- **Partieller UNIQUE-Index** erzwingt DB-seitig „max. eine aktive
  Standard-Vorlage pro Kategorie".

---

## 5. Engine + Module (TypeScript)

```
src/lib/export/
├── vorlagen-engine.ts     renderVorlage() — zentrale Render-Funktion
├── vorlagen-extract.ts    Platzhalter-Extraktion + DOCX-Validierung
├── vorlagen-seed.ts       Initial-Seed-Mechanik (Post-Migration-Hook)
├── docx.ts                wird auf Engine umgestellt
└── stellenanteil-antrag.ts wird auf Engine umgestellt
```

### 5.1 `renderVorlage()`

```ts
export async function renderVorlage(opts: {
  kategorieSchluessel: string;          // "nachtrag" | beliebiger User-Slug
  vorlageId?: number;                   // optional → Standard
  daten: Record<string, string>;        // vom Caller aufbereitete Felder
  qrInhalt?: string;                    // optional — wenn gesetzt: PNG eingebettet
}): Promise<{ buffer: Buffer; vorlage: { id: number; name: string } }>;
```

Logik:
1. Kategorie aus DB laden (Schluessel). Fehler → „Kategorie unbekannt".
2. Vorlage laden — `vorlageId` oder `WHERE kategorie_id=… AND ist_standard=TRUE AND aktiv=TRUE`.
3. Falls keine: `VorlageNichtVerfuegbarError` → Caller liefert 503 mit Hinweis „Bitte unter /admin/vorlagen hochladen".
4. Bei `qrInhalt`: PNG via `qrcode` generieren + ImageModule registrieren.
5. `Docxtemplater` mit `nullGetter()` = `"_______"` fuer fehlende Tags
   (sicherer Default, kein Code-Eval).
6. `doc.render(daten)`, `doc.getZip().generate({ type: "nodebuffer" })`.

### 5.2 `extrahierePlatzhalter(buffer)`

Nutzt `docxtemplater.parser`-API zur Tag-Extraktion (robust gegen Word-
Auto-Split, der `{lehrerVollname}` ueber zwei XML-Runs zerteilen kann).
Liefert deduplizierte Liste der Tag-Namen.

### 5.3 `validiereDocxBuffer(buffer)`

Sicherheits-Validierung beim Upload:
1. Magic-Bytes: `PK\x03\x04` (ZIP-Header)
2. PizZip-Probe: Buffer muss als ZIP oeffenbar sein
3. `[Content_Types].xml` muss im ZIP enthalten sein

Wirft bei Verletzung — Caller liefert 400 mit Detail.

### 5.4 `seedSystemVorlagenWennLeer(sql)`

Post-Migration-Hook in `migrate.mjs`:
- `SELECT count(*) FROM word_vorlagen` → wenn 0:
- Fuer jede System-Kategorie: `.docx` aus `src/lib/export/vorlagen/` lesen,
  Platzhalter extrahieren, INSERT mit `ist_standard=TRUE`, `aktiv=TRUE`,
  `hochgeladen_von='system'`.
- Idempotent: laeuft genau einmal beim First-Deploy.

---

## 6. API-Routen

| Pfad | Methode | Auth | Zweck |
|---|---|---|---|
| `/api/admin/vorlagen-kategorien` | GET | Mitarbeiter | Liste |
| `/api/admin/vorlagen-kategorien` | POST | Admin | Neue Kategorie anlegen |
| `/api/admin/vorlagen-kategorien/[id]` | PATCH | Admin | Bezeichnung/Felder/aktiv editieren |
| `/api/admin/vorlagen-kategorien/[id]` | DELETE | Admin | Soft-Delete (System-Kategorien geblockt) |
| `/api/admin/vorlagen` | POST | Admin | Upload (multipart/form-data) |
| `/api/admin/vorlagen?kategorie=…` | GET | Mitarbeiter | Liste |
| `/api/admin/vorlagen/[id]` | GET | Mitarbeiter | Original-DOCX downloaden |
| `/api/admin/vorlagen/[id]` | PATCH | Admin | Edit (ist_standard, aktiv, name, beschreibung) |
| `/api/admin/vorlagen/[id]` | DELETE | Admin | Soft-Delete (aktiv=false + ist_standard=false) |
| `/api/admin/vorlagen/[id]/preview` | GET | Admin | Test-Render mit Dummy-Daten |

### 6.1 Upload-Sicherheit

- Content-Type-Whitelist: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Magic-Bytes-Check (`PK\x03\x04`)
- Groessenlimit: **1 MB**
- `validiereDocxBuffer()` MUSS gruen sein
- Probe-Render mit Kategorie-Dummy-Daten — Fail = 400 mit Detail
- Filename-Sanitize bei `Content-Disposition` (Whitelist-Pattern wie schon
  im Nachtrag-Endpoint umgesetzt)
- Nur Admin darf hochladen — Audit-Log fuer jede Mutation

### 6.2 Render-Sicherheit

- `nullGetter` = `"_______"` (kein Code-Eval, kein Throw bei fehlenden Tags)
- Kein `assignmentMode` — verhindert Stored-Code-Injection ueber boesartige Tags
- Nur ImageModule registriert (nichts anderes)
- Inaktive Vorlagen (`aktiv=false`) werden nicht gerendert — 410 Gone

---

## 7. Admin-UI

```
/admin/vorlagen                     Hauptseite — Vorlagen-Liste, gruppiert nach Kategorie
/admin/vorlagen/kategorien          Kategorien-Verwaltung (System read-only)
/admin/vorlagen/[id]                Detail / Vorschau / Felder-Auflistung
```

### 7.1 Vorlagen-Hauptseite

- Tabelle pro Kategorie mit Spalten: Name, hochgeladen am/von, Aktiv-Toggle,
  Standard-Badge, Aktionen (Vorschau, Download, Bearbeiten, Loeschen).
- Button „Neue Vorlage" → Upload-Modal:
  1. Kategorie waehlen (Dropdown aus DB)
  2. Name + Beschreibung
  3. Datei waehlen
  4. Server validiert + extrahiert Platzhalter, zeigt:
     - bekannte Platzhalter (gruen)
     - unbekannte Platzhalter (gelb, Warnung — nicht-blockend)
     - Probe-Render-Status
  5. Optional „Als Standard fuer diese Kategorie setzen"
  6. Speichern

### 7.2 Kategorien-Verwaltung

- Tabelle aller Kategorien mit System-Badge bei `ist_system=true`
- Bei System-Kategorien: Schluessel/ist_system/Loeschen disabled, nur
  Bezeichnung, Beschreibung und `bekannte_felder` editierbar
- „Neue Kategorie" → Modal mit Slug-Validierung, Bezeichnung, Beschreibung,
  Felder-Editor (Add/Remove Liste)

### 7.3 Detail / Vorschau-Page

- Auflistung aller Platzhalter, getrennt nach „bekannt" / „unbekannt"
- Test-Render-Button mit zwei Modi: Dummy-Daten (Kategorie-Defaults) oder
  JSON-Eingabe-Feld
- Download-Buttons fuer Original und Test-Render

---

## 8. Integration in Bestand

### 8.1 `/api/export/nachtrag` (rewrite)

Neuer optionaler Param `?vorlageId=42`. Ohne Param → Standard.

```ts
const result = await renderVorlage({
  kategorieSchluessel: "nachtrag",
  vorlageId,
  daten: { lehrerVollname, vorname, nachname, ..., qrCode: "qr" },
  qrInhalt: `${vorname}|${nachname}|${personalnummer}`,
});
```

### 8.2 `/api/export/stellenanteil-antrag` (rewrite)

Analog — `kategorieSchluessel="stellenanteil_antrag"`, QR-Inhalt
`Schule|Stellenart|Wert|Datum|Aktenzeichen`.

### 8.3 Auswahl-Modal in `/nachtraege` und `/stellenanteile`

- Liste laed beim Render auch verfuegbare Vorlagen der Kategorie
- Beim „Erstellen"-Klick:
  - Wenn nur 1 aktive Vorlage → direkter Download (heutiges Verhalten)
  - Wenn ≥ 2 → Modal mit Dropdown, Standard vorausgewaehlt

---

## 9. Phasen-Plan

| Phase | Inhalt | Aufwand |
|---|---|---|
| **1 Foundation** | Migration 0016, Drizzle-Schema (2 Tabellen), `vorlagen-extract.ts`, `vorlagen-engine.ts`, `vorlagen-seed.ts`, Vitest fuer Extract+Validate | ~4 h |
| **2 Vorlagen-Admin-UI** | API-Routes (Upload, Liste, Patch, Delete, Preview), `/admin/vorlagen/page.tsx`, Upload-Modal, Detail-Page | ~4 h |
| **3 Kategorien-Admin-UI** | API-Routes Kategorien-CRUD, `/admin/vorlagen/kategorien/page.tsx`, Felder-Editor, System-Schutz | ~2 h |
| **4 Integration** | `/api/export/nachtrag` + `/api/export/stellenanteil-antrag` auf Engine umstellen, Auswahl-Modal in `/nachtraege` und `/stellenanteile` | ~3 h |
| **5 Seed + Doku + Cleanup** | `migrate.mjs`-Hook, Sidebar-Eintrag, CHANGELOG, Deployment-Doku, alte hardcoded Daten-Mappings raus | ~2 h |
| **Total** | | **~15 h** |

Pro Phase ein commit-faehiger Schritt. Nach jeder Phase Entscheidung
weiterzumachen oder zu pausieren.

---

## 10. Erfolgskriterien (verifizierbar)

| Phase | Verifikation |
|---|---|
| 1 | `npx vitest run` gruen, Migration laeuft auf Test-DB durch, Seed-Hook funktioniert |
| 2 | `/admin/vorlagen`: Upload eines Test-DOCX führt zu DB-Eintrag, Liste zeigt ihn, Vorschau-Download liefert valides DOCX |
| 3 | Neue User-Kategorie „test_versorgung" anlegen, Vorlage hochladen, Preview rendern |
| 4 | `/nachtraege` → „Erstellen" funktioniert wie heute, jetzt aber aus DB-Vorlage; identischer Output zum Vor-Phase-4-Stand |
| 5 | Frischer Container-Start gegen leere DB → Standard-Vorlagen sind nach Migration in DB |

---

## 11. Edge-Cases & Risiken

| # | Risiko | Mitigation |
|---|---|---|
| 1 | Word-Auto-Split: `{lehrerVollname}` ueber mehrere XML-Runs | `docxtemplater.parser`-API macht Run-Merging — Tests dafuer |
| 2 | Korrupte/boesartige .docx beim Upload | Magic-Bytes + Groessenlimit + Probe-Render — PizZip wirft bei kaputtem ZIP → 400 |
| 3 | docxtemplater Code-Injection via `{=…}`-Tags | `nullGetter` + kein `assignmentMode` (sicherer Default) |
| 4 | Race beim Standard-Setzen | DB-Transaktion + partieller UNIQUE-Index erzwingt Konsistenz |
| 5 | Letzte aktive Vorlage einer Kategorie wird deaktiviert | Render liefert 503 mit Hinweis; UI faengt ab und zeigt Banner |
| 6 | Standard-Vorlage wird deaktiviert ohne `ist_standard=false` | Server-Action setzt beide Flags atomar |
| 7 | Speicherbelastung bei vielen parallelen Renders | bytea-Buffer ~200 KB × 100 RPS = 20 MB transient — akzeptabel |
| 8 | Vorlage ohne `qrCode`-Tag | Engine prueft Platzhalter; ImageModule wird nur registriert wenn Tag da |
| 9 | System-Kategorie wird umbenannt → Code-Caller bricht | DB-Constraint: bei `ist_system=true` ist `schluessel` immutable, `aktiv` immer true |
| 10 | User-Kategorie ohne Code-Caller | Production-Render geht — aber kein Endpoint-Caller. Nur Vorschau nutzbar. Erwartung dokumentiert. |

---

## 12. Sicherheits-Konzept

| Operation | Mindestrolle | Audit | Rate-Limit |
|---|---|---|---|
| Upload | Admin | ja | empfehlenswert (Repo-weit nicht vorhanden, Folge-Sprint) |
| Liste / Download | Mitarbeiter | – | – |
| Vorschau / Preview | Admin | ja | empfehlenswert |
| PATCH (aktiv, ist_standard, name) | Admin | ja | – |
| DELETE (Soft) | Admin | ja | – |
| Kategorie anlegen / aendern | Admin | ja | – |
| Render via Endpoint (Nachtrag/Stellenanteil) | Mitarbeiter | ja (heute schon) | empfehlenswert |

---

## 13. Was bewusst NICHT in v1 ist

- **Versionierungs-Tabelle / Diff-Ansicht** — `audit_log` reicht
- **Live-Editor im Browser (WYSIWYG)** — Word ist der Editor
- **Pro-User-/Pro-Schule-Vorlagen** — eine Vorlage gilt für alle
- **Mehrsprachigkeit** — bei Bedarf als zusaetzliche Vorlage anlegen
- **PDF-Konvertierung im Browser** — Office macht das
- **Field-Mapping-UI** (User mappt `{lerhername}` → `lehrerVollname`) — User
  korrigiert die Vorlage stattdessen
- **Rate-Limit-Infrastruktur** — Repo-weit noch nicht vorhanden
  (Folge-Sprint laut v0.7-Deployment-Doc)

---

## 14. Offene Punkte fuer die naechste Session

- Antworten zu den 5 Konzept-Fragen sind eingearbeitet (Stand 2026-05-06)
- Phase 1 kann starten, sobald „go" kommt
- Vor Phase 4 (Integration) sollte `/code-review` ueber Phase 1-3 laufen,
  bevor die alten Generatoren ersetzt werden

---

## Quellen / Referenzen

- Bestehender Code: `src/lib/export/docx.ts`, `src/lib/export/stellenanteil-antrag.ts`
- Bestehende Templates: `src/lib/export/vorlagen/*.docx`
- Auth-Helper: `src/lib/auth/permissions.ts`
- Audit-Helper: `src/lib/audit.ts`
- Pattern-Vorbild Admin-UI: `src/app/admin/n8n-webhooks/`
- Architektur-Vorgaben: `CLAUDE.md`, Karpathy-Prinzipien
