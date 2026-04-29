# Dokumentation

## 📌 Aktiv

| Was | Wo | Beschreibung |
|---|---|---|
| **Periodenmodell v0.7** | [`konzepte/periodenmodell_v0.7/`](konzepte/periodenmodell_v0.7/) | Aktuelle Architektur — Untis-Periodenmodell + Korrektur-Layer + DIN-A4-Detail-PDF |
| **Feature-Doku** | [`DOKUMENTATION.md`](DOKUMENTATION.md) | Berechnungen, Sync, Statistik-Codes, Architektur (auf Stand v0.6) |
| **Projektplan (Ursprung)** | [`PROJEKTPLAN.md`](PROJEKTPLAN.md) | NRW-Berechnungsregeln, DB-Schema, Phasen |

## 🚀 Deployment

| Release | Datei | Status |
|---|---|---|
| v0.4.0 + v0.5.0 | [`deployment/v0.4.0_v0.5.0.md`](deployment/v0.4.0_v0.5.0.md) | Live seit 2026-04-23/24 |
| v0.6.0 (Statistik-Codes) | [`deployment/v0.6.0.md`](deployment/v0.6.0.md) | **Offen** |
| v0.6.0 n8n-Workflow | [`deployment/n8n_workflow_v0.6.0.md`](deployment/n8n_workflow_v0.6.0.md) | Begleit-Doku |
| v0.7 (Periodenmodell) | _noch zu erstellen_ | Lokal verifiziert, n8n-Anpassung steht aus |

## 📚 Konzepte

### Periodenmodell v0.7 (aktuell)
[`konzepte/periodenmodell_v0.7/`](konzepte/periodenmodell_v0.7/)

| Datei | Zweck |
|---|---|
| `konzept.md` / `konzept.pdf` | Architektur-Konzept (11 Sektionen), Kollegen-Review-tauglich — **aktuelle Version v0.4** |
| `konzept.html` | Render-Quelle für PDF-Re-Generierung |
| `uebergabe.md` / `uebergabe.pdf` | Phase-2-Übergabe — Stand fertig, Stand offen, Code-Wegweiser, Test-Stand |
| `archiv/` | Vorgänger-PDFs (v0.1, v0.3) zur Nachverfolgung |

## 🧪 SQL-Skripte

[`sql/`](sql/) — Verifikate und Backfill-Skripte zum direkten Ausführen:

```bash
docker exec -i hr_stellen_ist_berechnung-db-1 psql -U stellenist -d stellenistberechnung -f /dev/stdin < docs/sql/<datei>
```

| Datei | Zweck |
|---|---|
| `verify_bergmann_v1.sql` | Bergmann-Stand mit alter Periodenstruktur (vor Periodenmodell) |
| `verify_bergmann_v2.sql` | Bergmann-Verifikat im Periodenmodell — drei Sektionen (deputat_pro_periode, v_deputat_aenderungen, v_deputat_monat_tagesgenau) |
| `verify_david_abrams_2025.sql` | David Abrams Periodencheck SY 2024/25 |
| `verify_david_abrams_untis.sql` | David Abrams Untis-Rohdaten-Vergleich |
| `backfill_aenderungshistorie_2025_2026.sql` | Einmaliger Backfill der historischen Wertwechsel (am 2026-04-27 ausgeführt) |

## 🛠 Test-Skripte (außerhalb von docs/)

Liegen unter [`scripts/`](../scripts/) im Repo-Root:

| Datei | Zweck |
|---|---|
| `test-bergmann-v2.mjs` | Verifikat-Run: Untis-Terms + Bergmann-Periodenwerte via sync-v2 hochladen |
| `backfill-v2-from-lehhrer-txt.mjs` | Backfill aller 96 Lehrer aus `lehhrer.txt` ins Periodenmodell |
| `import-lehrer-local.mjs` | Klassischer v1-Import (nur noch für Vergleichszwecke relevant) |

## 📖 Handbuch

[`handbuch/`](handbuch/) — Word-Handbuch v1.0 (WIP, generiert via `node generate_handbuch.js`).

## 🖼 Screenshots

[`screenshots/`](screenshots/) — Archiv (Bug-Belege, UI-Stand).
