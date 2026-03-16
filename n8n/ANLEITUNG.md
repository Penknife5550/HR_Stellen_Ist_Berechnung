# n8n Integration: Stellenistberechnung

## Uebersicht

Der bestehende Workflow #221 ("Personal: Untis Deputat Uebersicht") wird um einen
HTTP-Request-Node erweitert. Dadurch werden Deputatsdaten **parallel** sowohl in den
bestehenden PostgreSQL-Snapshot als auch in die neue Stellenistberechnung-App geschrieben
(Dual-Write).

```
                          Workflow #221 (bestehend)
                          ========================

Schedule Trigger (08:00)
        │
        ▼
MSSQL: Untis Teacher+Terms auslesen
        │
        ▼
Code Node: Daten fuer DB vorbereiten
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
PostgreSQL: Snapshot                 [NEU] HTTP Request:
upserten (bestehend)                POST /api/deputate/sync
        │                                  │
        ▼                                  ▼
Vergleich mit letztem               [NEU] IF: Sync erfolgreich?
Snapshot                                   │
        │                           ┌──────┴──────┐
        ▼                           ▼             ▼
IF: Aenderungen?              Weiter        Error-Handling:
        │                                  Teams/E-Mail Alert
   ┌────┴────┐
   ▼         ▼
E-Mail    Nichts tun
senden
```

## Schritt-fuer-Schritt Anleitung

### 1. Umgebungsvariablen in n8n setzen

In n8n unter **Settings > Variables** folgende Variable anlegen:

| Variable | Wert | Beschreibung |
|----------|------|-------------|
| `STELLENIST_API_URL` | `http://<server>:3000/api/deputate/sync` | URL der Stellenist-App |
| `STELLENIST_API_KEY` | `credo-sync-key-2026` | API-Key (muss mit .env uebereinstimmen) |

> **Wichtig:** Im Produktivbetrieb den API-Key durch einen sicheren Wert ersetzen!

### 2. Neuen Code Node hinzufuegen: "Daten fuer Stellenist aufbereiten"

Diesen Node **nach** dem bestehenden "Daten fuer DB vorbereiten" Node einfuegen.
Er transformiert die Untis-Daten in das Format, das die Stellenist-API erwartet.

**Node-Typ:** Code
**Modus:** Run Once for All Items
**Code:** Siehe Datei `code-node-transform.js`

### 3. HTTP Request Node hinzufuegen: "Sync an Stellenist-App"

Diesen Node **nach** dem Code Node aus Schritt 2 einfuegen.

**Node-Typ:** HTTP Request
**Konfiguration:**

| Einstellung | Wert |
|-------------|------|
| Method | POST |
| URL | `{{ $vars.STELLENIST_API_URL }}` |
| Authentication | None (API-Key ist im Body) |
| Body Content Type | JSON |
| Specify Body | Using JSON |
| JSON | `{{ JSON.stringify($input.first().json) }}` |
| Options > Timeout | 30000 (30 Sekunden) |
| Options > Retry on Fail | true |
| Options > Max Retries | 2 |
| Options > Wait Between Retries | 3000 |
| Continue On Fail | true |

### 4. IF Node hinzufuegen: "Sync erfolgreich?"

**Node-Typ:** IF
**Bedingung:**

| Feld | Operator | Wert |
|------|----------|------|
| `{{ $json.success }}` | is equal to | true |

**True-Pfad:** Weiter (oder Log-Output)
**False-Pfad:** Error-Handling (siehe Schritt 5)

### 5. Error-Handling Node (optional aber empfohlen)

Bei Fehler eine Benachrichtigung senden:

**Node-Typ:** Microsoft Teams / Send Email
**Nachricht:**
```
⚠️ Stellenist-Sync fehlgeschlagen

Zeitpunkt: {{ $now.format('dd.MM.yyyy HH:mm') }}
Fehler: {{ $json.error ?? 'Unbekannter Fehler' }}
HTTP Status: {{ $json.statusCode ?? 'N/A' }}

Bitte manuell pruefen.
```

### 6. Verbindungen herstellen

1. "Daten fuer DB vorbereiten" → "Daten fuer Stellenist aufbereiten" (parallel zum bestehenden PostgreSQL-Node)
2. "Daten fuer Stellenist aufbereiten" → "Sync an Stellenist-App"
3. "Sync an Stellenist-App" → "Sync erfolgreich?"
4. "Sync erfolgreich?" (false) → Error-Handling

## Test

### Manueller Test im n8n Editor

1. Workflow #221 oeffnen
2. Auf "Test Workflow" klicken (manueller Trigger)
3. Pruefen ob der HTTP Request Node gruenes Haekchen zeigt
4. In der Stellenist-App unter `/deputate` pruefen ob Daten erscheinen
5. Unter `/historie` pruefen ob ein Sync-Log-Eintrag vorhanden ist

### Test mit CLI-Script

```bash
cd stellenistberechnung
npx tsx scripts/test-sync-api.ts
```

## API-Referenz

### POST /api/deputate/sync

**Request:**
```json
{
  "api_key": "credo-sync-key-2026",
  "sync_datum": "2026-03-16",
  "schuljahr_text": "2025/2026",
  "term_id": 3,
  "date_from": "01.02.2026",
  "date_to": "30.06.2026",
  "lehrer": [
    {
      "teacher_id": 123,
      "name": "Mue",
      "vollname": "Mueller, Max",
      "personalnummer": "P001",
      "stammschule": "GES",
      "deputat": 25.5,
      "deputat_ges": 20.0,
      "deputat_gym": 5.5,
      "deputat_bk": 0
    }
  ]
}
```

**Response (Erfolg):**
```json
{
  "success": true,
  "verarbeitet": 1,
  "fehler": 0,
  "monate": 5,
  "message": "1 Lehrer fuer 5 Monat(e) synchronisiert."
}
```

**Response (Fehler):**
```json
{
  "error": "Beschreibung des Fehlers"
}
```

**HTTP Status Codes:**
| Code | Bedeutung |
|------|-----------|
| 200 | Erfolg |
| 400 | Validierungsfehler (Payload ungueltig) |
| 401 | API-Key ungueltig |
| 500 | Interner Serverfehler |

## Fehlerbehebung

| Problem | Loesung |
|---------|---------|
| 401 Unauthorized | API-Key in n8n-Variable pruefen, muss mit `.env` uebereinstimmen |
| 400 Haushaltsjahr nicht gefunden | In der App unter Einstellungen pruefen ob das Haushaltsjahr angelegt ist |
| 500 Interner Fehler | Server-Logs der Next.js-App pruefen (`npm run dev` Konsole) |
| Timeout | Stellenist-App erreichbar? Firewall-Regeln pruefen |
| Keine Daten in App | Pruefen ob date_from/date_to korrekt sind (DD.MM.YYYY Format) |
