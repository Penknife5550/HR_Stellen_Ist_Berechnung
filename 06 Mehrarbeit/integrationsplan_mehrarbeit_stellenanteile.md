# Integrationsplan — Untis-Mehrarbeit → Stellenanteile

> **Ziel:** Die Mehrarbeit aus Untis `Substitution` automatisiert in die App
> `HR_Stellen_Ist_Berechnung` einspeisen, sodass sie korrekt ins **Stellenist**
> (Stellenanteile) einfließt — ohne die bestehende Berechnung zu duplizieren.
> **Stand:** 2026-06-17 | Grundlage: gelesener Code-Stand des Repos + Untis-Modellanalyse.
> **Leitprinzip des Repos (beibehalten):** „Untis ist die Quelle der Wahrheit,
> die App spiegelt 1:1 und bereitet auf" (vgl. Migration `0008`).

---

## 1. Ausgangslage (was schon existiert — nicht neu bauen)

- **Stellenist-Formel** inkl. Mehrarbeits-Umrechnung: `src/lib/berechnungen/stellenist.ts`
  (`mehrarbeitStunden / (Monate × Regeldeputat)`). **Fertig.**
- **Tabelle `mehrarbeit`** mit lehrer-bezogenem Stunden-Modus + CHECK
  (`0003`/`0004`). **Fertig** — das ist die Zielsenke.
- **Periodenmodell** `deputat_pro_periode` + `untis_terms` + Views, gefüllt via
  n8n-Sync (`/api/deputate/sync-v2`). **Fertig** — Vorlage für den neuen Sync.
- **Lehrer-Mapping** `lehrer.untis_teacher_id`, `lehrer.personalnummer`,
  `lehrer.statistik_code`. **Fertig.**

> **Konsequenz:** Es fehlt **kein Berechnungskern**, sondern nur der
> **Zufluss** der Vertretungs-Mehrarbeit in Stunden je Lehrkraft/Monat/Schule.

---

## 2. Zielarchitektur (analog zum bestehenden Deputat-Sync)

```
Untis-DB ──► n8n-Flow "Mehrarbeit-Sync" ──► POST /api/mehrarbeit/sync
   (Substitution,                              │
    Teacher, Calendar)                         ▼
                              Staging: untis_substitution_raw
                                              │  (Aggregation + Klassifikation)
                                              ▼
                              View v_mehrarbeit_untis_monat
                                              │  (Vertretung − Freisetzung, je LK/Monat/Schule)
                                              ▼
                              UPSERT in Tabelle  mehrarbeit (Modus: lehrer-bezogen, quelle='untis')
                                              │
                                              ▼
                              bestehende Stellenist-Berechnung  ──►  Stellenanteile
```

Bewusst **gleiches Muster** wie `sync-v2`: Roh-Staging spiegeln, per View
aufbereiten, idempotent upserten, Sync protokollieren (`deputat_sync_log`-Analog).

---

## 3. Phasenplan

### Phase 0 — Klären/Verifizieren (blockierend, vor Code)
- [ ] **Bagatellgrenze beim Stellenist?** Fachentscheid: für Stellenanteile
      ohne 3-Std.-Floor/24-Std.-Kappung rechnen (Empfehlung der Doku §4.1).
- [ ] **`Substitution.Flags`/`BookingType`** am echten Datensatz dekodieren
      → Mapping auf `art ∈ {VERTRETUNG, FREISETZUNG, ENTFALL}`.
- [ ] **Skalierung `SubstValue`** (×1000?) und **Untis-`Date`-Kodierung** prüfen.
- [ ] **Schulzuordnung** der Vertretung festlegen (Unterrichtsschule vs. Stammschule).
- *Vorgehen:* je eine Stichprobe aus `Substitution` über das Power-BI-MCP ziehen.

### Phase 1 — Datenmodell (additiv, kein Bruch)
- [ ] Migration `00XX_untis_substitution_raw.sql`:
  - Tabelle `untis_substitution_raw` (1:1-Spiegel der relevanten
    `Substitution`-Felder: `substitution_id` PK, `schoolyear_id`, `datum`,
    `teacher_id_subst`, `teacher_id_lessn`, `subst_value`, `art`, `class_ids`,
    `deleted`, `sync_datum`).
  - Spalte `mehrarbeit.quelle` ergänzen (`'manuell' | 'untis'`), damit
    automatische und manuelle Einträge unterscheidbar sind (Vorrang-Regeln,
    Audit). Bestehender CHECK bleibt unberührt.
- [ ] Drizzle-Schema in `src/db/schema.ts` nachziehen.

### Phase 2 — Aggregations-View
- [ ] Migration `00XX_view_mehrarbeit_untis.sql`:
  - `v_mehrarbeit_untis_monat` = je (`lehrer_id`, `haushaltsjahr_id`, `monat`,
    `schule_id`): `SUM(Vertretung) − SUM(Freisetzung)` aus
    `untis_substitution_raw`, gejoint auf `lehrer.untis_teacher_id`.
  - Monatszuordnung über konvertiertes `datum`; Haushaltsjahr über `haushaltsjahre`.
  - **Kein** Bagatell-/Kappungsfilter (Stellenist-Pfad, vgl. Phase 0).

### Phase 3 — Sync-Endpoint + n8n
- [ ] `src/app/api/mehrarbeit/sync/route.ts` (Vorlage: `deputate/sync-v2`):
  - Auth/Token wie bestehende Sync-Routes, Zod-Validierung, try/catch mit
    deutscher Fehlermeldung, Audit-Log, idempotenter UPSERT in
    `untis_substitution_raw`.
  - Danach `mehrarbeit` (lehrer-bezogen, `quelle='untis'`) aus
    `v_mehrarbeit_untis_monat` upserten — manuelle Einträge (`quelle='manuell'`)
    nicht überschreiben.
- [ ] n8n-Flow „Mehrarbeit-Sync" (analog `#223 … sync-v2`): Untis →
    Substitution + Teacher + Calendar lesen → an Endpoint pushen. JSON in
    `docs/n8n/` ablegen.

### Phase 4 — UI/Transparenz
- [ ] `/mehrarbeit`: automatische Einträge kennzeichnen (Badge „aus Untis"),
      manuelle Übersteuerung erlauben (Korrektur-Layer-Gedanke wie bei Deputaten).
- [ ] `/stellenist`-Drilldown: Mehrarbeitsanteil getrennt ausweisen
      (Basis-Deputat vs. Vertretungs-Mehrarbeit), für die Bezirksregierungs-Nachweise.

### Phase 5 — Validierung
- [ ] Verifikations-SQL je Referenzlehrkraft (Muster: `docs/sql/verify_*`):
      Untis-Substitution-Summe == `mehrarbeit.stunden` == Stellenanteil-Beitrag.
- [ ] Gegenrechnung gegen einen bekannten PEDAV-LBV-Bogen (Plausibilität Stunden).
- [ ] Edge Cases: `SubstValue=0`, gelöschte Zeilen, LK ohne `untis_teacher_id`,
      Monats-/Schuljahresgrenzen, Teilzeit.

---

## 4. Abgrenzung zum Vergütungs-Pfad

Der Euro-/Vergütungs-Pfad (`mehrarbeit_verguetung_postgres.sql`:
`SalaryPeHour` → Schlüssel → BASS-Satz) ist **getrennt** und kein Teil dieses
Plans. Beide Pfade nutzen **dieselbe** Mehrarbeitsstundensumme aus
`Substitution` als Eingang, aber:
- Stellenanteil: **ohne** Bagatellgrenze/Kappung (volle Stunden).
- Vergütung: **mit** Bagatellgrenze 3 Std. + Kappung 24/288.

Gemeinsamer, einmal verifizierter `v_mehrarbeit_untis_monat`-Kern (Phase 2)
versorgt perspektivisch beide — die Filter sitzen erst im jeweiligen Output.

---

## 5. Risiken / Wächter

- **Doppelzählung Plan vs. Vertretung:** sicherstellen, dass `Substitution` nur
  *zusätzliche* Mehrleistung enthält und das strukturelle Deputat allein über
  `deputat_pro_periode` ins Stellenist geht (Doku §2.1).
- **Stille Falschskalierung** (`SubstValue` ×1000): vor Go-Live hart verifizieren.
- **Mehrfach-Quelle** in `mehrarbeit`: klare Vorrangregel manuell vs. Untis,
  sonst überschreibt der Sync händische Korrekturen.
- **DSGVO/PII:** Sync-Route mit Mitarbeiter-Rolle absichern (wie
  `lehrer-detail`/`stellenist-drilldown`), Personaldaten nur maskiert loggen.

---

## 6. Empfohlene Reihenfolge der nächsten Schritte

1. Phase 0 abschließen (Stichproben über Power-BI-MCP) — **klein, blockierend.**
2. Phase 1+2 als eine additive Migration + Drizzle-Schema.
3. Phase 3 Endpoint gegen die `sync-v2`-Vorlage, dann n8n-Flow.
4. Phase 5 Validierung gegen Referenzlehrkraft + PEDAV-Bogen, dann UI (Phase 4).
