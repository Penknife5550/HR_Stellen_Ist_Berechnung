-- Composite-Index fuer Trend-Queries auf audit_log.
--
-- Wird genutzt von getStatistikCodeUebersicht (Dashboard-Karte): zaehlt
-- Statistik-Code-Wechsel der letzten 30 Tage. Ohne Index waere das ein
-- Sequential Scan auf wachsender audit_log-Tabelle (Sync schreibt pro
-- Code-Wechsel einen Eintrag).
--
-- WHERE-Klausel der Query: tabelle = 'lehrer' AND aktion = 'UPDATE'
--   AND alte_werte ? 'statistikCode' AND zeitpunkt > now() - interval '30 days'
--
-- Composite-Index deckt die ersten drei Filter ab; der jsonb-Operator
-- profitiert davon nicht direkt, aber die Vorfilterung reduziert die
-- jsonb-Operator-Pruefung auf eine kleine Teilmenge.
CREATE INDEX IF NOT EXISTS "idx_audit_log_trend"
  ON "audit_log" ("tabelle", "aktion", "zeitpunkt" DESC);
