# n8n-Workflow #223 — Patches fuer v0.6.0 (Statistik-Codes)

> **Zweck:** Genaue Aenderungen am n8n-Workflow, damit der Untis-Sync das Feld `StatisticCodes` an die App weiterreicht.
>
> **Status lokal:** Die JSON-Datei `#223 - Stellenist Deputat-Sync (Untis → Stellenist-App).json` im Projekt-Root enthaelt bereits den Soll-Stand. Sie ist nicht in Git versioniert (n8n-Konvention). Dieses Dokument beschreibt die exakten Diffs, damit die Aenderungen in der Produktions-n8n-Instanz (https://n8n.fes-minden.de/) nachvollziehbar uebernommen werden koennen.

---

## 🎯 Was sich aendert

Zwei Knoten im Workflow #223:

1. **MSSQL-Query-Knoten** — `t.StatisticCodes` zur SELECT-Liste hinzufuegen.
2. **Code-Knoten „Daten fuer Stellenist aufbereiten"** — `statistik_code`-Feld pro Lehrer-Objekt mappen.

Beides ist additiv: Der Sync-Endpoint akzeptiert das Feld optional; ohne den Patch bleibt es schlicht aus dem Payload weg, der Sync funktioniert weiter wie vorher.

---

## 1️⃣ MSSQL-Query (Knoten direkt nach dem Trigger)

### Aenderung im SELECT-Block

Direkt nach `t.PNumber AS Personalnummer,` eine Zeile einfuegen:

```diff
     t.Name,
     t.PNumber AS Personalnummer,
+    t.StatisticCodes AS Statistik_Code,
     t.OwnSchool AS Stammschule,
```

Nichts weiter — Untis liefert das Feld bereits, wir muessen es nur selektieren. Bei Lehrern ohne Code ist der Wert NULL oder leer, was im naechsten Schritt sauber behandelt wird.

### Hinweise

- `StatisticCodes` (Plural, mit „s") ist der Spaltenname in `Teacher`. Untis kann theoretisch mehrere komma-separierte Codes liefern; der Code-Knoten nimmt nur den ersten (siehe unten).
- Keine WHERE-Aenderung noetig — Lehrer ohne Code werden weiterhin synchronisiert (auch sie tauchen im Personalstruktur-Bericht in der „Ohne Code"-Zeile auf, was gewollt ist).

---

## 2️⃣ Code-Node „Daten fuer Stellenist aufbereiten"

Innerhalb der Schleife, in der pro Lehrer ein Output-Objekt gebaut wird, eine Zeile am Ende des Lehrer-Objekts hinzufuegen:

```diff
     periodenMap.get(key).lehrer.push({
       teacher_id: parseInt(d.TEACHER_ID, 10),
       name: String(d.Name).substring(0, 50),
       vollname: String(d.Vollname).substring(0, 200),
       personalnummer: d.Personalnummer ? String(d.Personalnummer).substring(0, 20).trim() : null,
       stammschule: String(d.Stammschule ?? '').substring(0, 10),
       deputat: Math.round((parseFloat(d.Deputat) || 0) * 1000) / 1000,
       deputat_ges: Math.round((parseFloat(d.Deputat_GES) || 0) * 1000) / 1000,
       deputat_gym: Math.round((parseFloat(d.Deputat_GYM) || 0) * 1000) / 1000,
       deputat_bk: Math.round((parseFloat(d.Deputat_BK) || 0) * 1000) / 1000,
+      statistik_code: d.Statistik_Code ? String(d.Statistik_Code).substring(0, 5).trim().toUpperCase() : null,
     });
```

### Was die Zeile macht

| Schritt | Begruendung |
|---|---|
| `d.Statistik_Code ? ... : null` | Lehrer ohne `StatisticCodes` → `null`. Die App speichert das als NULL in `lehrer.statistik_code`. |
| `String(...)` | Defensives Casten falls Untis unerwartet eine Zahl liefert. |
| `.substring(0, 5)` | DB-Spalte ist `varchar(5)`. Schuetzt vor unbeabsichtigter Trunkierung in der DB. |
| `.trim().toUpperCase()` | Konsistenz (App tut dasselbe bei manueller Anlage). Server-Whitelist ist case-sensitive auf Grossbuchstaben. |

### Robustheit App-seitig

`src/lib/statistikCode.ts → normalizeStatistikCode()` schuetzt zusaetzlich:

- Unbekannte Codes (z.B. neuer NRW-Code, der lokal noch nicht angelegt ist) werden verworfen — kein FK-Crash, der Lehrer behaelt seinen vorherigen Code.
- Leere/null-Werte ueberschreiben einen bestehenden Code NICHT (Datenverlust-Schutz, falls Untis temporaer leer liefert).

---

## 3️⃣ Vorgehen in der Produktions-n8n-Instanz

URL: **https://n8n.fes-minden.de/**

### Empfohlen: Import der lokalen JSON (sicherer)

1. Lokale JSON-Datei: `#223 - Stellenist Deputat-Sync (Untis → Stellenist-App).json` (im Projekt-Root)
2. n8n-UI oeffnen → Workflow **„#223"** oeffnen
3. **„⋮ → Download"** → alten Stand als Sicherung speichern
4. **„⋮ → Import from File"** → die lokale JSON waehlen
5. Diff in der UI pruefen (n8n hebt geaenderte Knoten hervor)
6. **Save** → Workflow `Active` lassen

### Alternativ: Manuelle Bearbeitung im UI

Falls Import nicht moeglich:

1. Knoten **„MSSQL-Query"** anklicken → Query-Feld → die `t.StatisticCodes`-Zeile einfuegen
2. Knoten **„Daten fuer Stellenist aufbereiten"** anklicken → JS-Code → die `statistik_code:`-Zeile einfuegen
3. **Save** in beiden Knoten
4. Workflow auf `Active` lassen

---

## 4️⃣ Smoke-Test nach dem Workflow-Update

### 4.1 Manueller Run im n8n-UI

```
n8n-UI → Workflow #223 → "Execute Workflow"
```

- [ ] Letzter Knoten **„POST → /api/deputate/sync"** liefert pro Periode `success: true`
- [ ] Keine Items mit `error`-Feld

### 4.2 DB-Verifikation auf dem Server

```sql
-- 1. Verteilung der Codes nach dem Sync
SELECT statistik_code, COUNT(*)
FROM lehrer
WHERE aktiv = true
GROUP BY statistik_code
ORDER BY COUNT(*) DESC;
```

Erwartet: mehrere Codes (L/LT/U/UT/...) sind belegt; NULL-Anteil ist klein (nur Lehrer ohne `StatisticCodes` in Untis).

```sql
-- 2. Audit-Trail der Code-Wechsel beim ersten Sync nach dem Patch
SELECT COUNT(*) AS code_setzungen
FROM audit_log
WHERE tabelle = 'lehrer'
  AND aktion = 'UPDATE'
  AND alte_werte ? 'statistikCode'
  AND zeitpunkt > NOW() - INTERVAL '1 hour';
```

Erwartet: ungefaehr so viele Eintraege wie Lehrer mit Code (beim ersten Sync wird fuer jeden ein Audit-Log geschrieben).

### 4.3 UI-Check

- `/dashboard` → Personalstruktur-Card zeigt jetzt eine Verteilung statt nur „Ohne Code"
- `/mitarbeiter` → Code-Spalte zeigt Badges
- 30T-Trend-Badge oben rechts in der Card zeigt die Anzahl der Code-Wechsel

---

## 5️⃣ Optional: Backfill-Workflow

Falls retroaktiver Sync mehrerer Schuljahre gewuenscht ist (analog zu v0.4.0/v0.5.0):

- Workflow **„Backfill HJ 2025 + 2026 (Stellenist-App)"** mit denselben zwei Patches versehen.
- Erst nach erfolgreichem normalen Sync und Verifikation der Codes ausfuehren.

Die Backfill-JSON liegt nicht im Projekt-Repo (die JSON wurde fuer das Statistik-Codes-Feature nicht aktualisiert, da der normale Tages-Sync genuegt um den Bestand binnen Stunden zu fuellen). Bei Bedarf nach gleichem Schema patchen.

---

## 6️⃣ Rollback

Falls etwas schief geht:

1. n8n-UI → Workflow #223 → **„⋮ → Import from File"** → die heruntergeladene Sicherungs-JSON aus Schritt 3 importieren.
2. Save → Active.

App-seitig sind keine Aenderungen noetig; ein leerer/fehlender `statistik_code` im Payload wird sauber als „kein Code uebermittelt" interpretiert (existing-Wert bleibt, neue Lehrer kommen ohne Code rein). Kein FK-Crash.

---

## 📚 Referenz

- **App-Endpoint**: `src/app/api/deputate/sync/route.ts:283-298` — Whitelist-Check via `normalizeStatistikCode`.
- **Pure-Helper**: `src/lib/statistikCode.ts` — `normalizeStatistikCode`, `detectStatistikCodeChange`.
- **Tests**: `tests/lib/statistikCode.test.ts` — 9 Faelle fuer `normalizeStatistikCode`, 7 fuer `detectStatistikCodeChange`.
- **Deployment-Schritt**: `v0.6.0.md` Schritt 4.
- **Test-Skript lokal**: `test-sync.mjs` (gegen `localhost:3000`) — verwendet dasselbe Mapping zu Verifikationszwecken.
