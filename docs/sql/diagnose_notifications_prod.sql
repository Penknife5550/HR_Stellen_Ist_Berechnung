-- ============================================================================
-- DIAGNOSE: Warum kommen keine Mails? (Produktions-Postgres, read-only)
-- ============================================================================
-- Wo ausfuehren: auf dem Prod-Server deputat.fes-credo.de
--
--   sudo docker exec -i stellenist-db psql -U stellenist -d stellenistberechnung \
--     < docs/sql/diagnose_notifications_prod.sql > notifications_diagnose.txt
--
-- Alle Abfragen sind reine SELECTs. Das HMAC-Secret wird NICHT ausgegeben,
-- nur ein Vergleich gegen das in den Flows #225/#226/#227 hinterlegte Secret.
--
-- Hintergrund: Die App protokolliert eine Zustellung als "success", sobald der
-- n8n-Webhook HTTP 200 antwortet — und das tut er im Default sofort, bevor der
-- Flow laeuft. Diese Abfragen trennen daher drei Faelle:
--   A) Es gab nie ein Event   -> Ursache liegt in der App (v0.8 behebt das)
--   B) Event ja, Zustellung fehlgeschlagen -> Ursache liegt an Ziel/URL/Netz
--   C) Event ja, Zustellung ok -> Ursache liegt in n8n (HMAC, SMTP)
-- ============================================================================

\echo '===== N1: Notification-Ziele ====='
-- Erwartung: je ein aktives Ziel fuer hauptdeputat.changed und
-- verteilung.changed, URL mit /webhook/ (NICHT /webhook-test/).
--
-- Secret-Abgleich ohne Klartext: `secret_fingerprint` ist der Anfang des
-- MD5-Werts. Vergleiche ihn mit dem Fingerprint des in den n8n-Flows
-- hinterlegten Secrets:
--     printf '%s' '<Secret aus dem n8n-Node>' | md5sum | cut -c1-12
-- Stimmen beide ueberein, passt das Secret.
SELECT
  t.id,
  t.name,
  t.aktiv,
  t.url,
  (t.url LIKE '%/webhook-test/%')                       AS ist_test_url,
  (t.secret IS NOT NULL)                                AS secret_gesetzt,
  left(md5(coalesce(t.secret, '')), 12)                 AS secret_fingerprint,
  (t.event_types ? 'hauptdeputat.changed')              AS abo_hauptdeputat,
  (t.event_types ? 'verteilung.changed')                AS abo_verteilung,
  (t.event_types ? 'lehrer.created')                    AS abo_neuer_lehrer,
  (t.event_types ? 'sync.completed')                    AS abo_sync_ok,
  (t.event_types ? 'sync.failed')                       AS abo_sync_fehler,
  t.headers IS NOT NULL                                 AS zusatz_header,
  t.erstellt_von,
  t.created_at
FROM notification_targets t
ORDER BY t.id;

\echo ''
\echo '===== N2: Wurden ueberhaupt jemals Events erzeugt? ====='
-- Kein Treffer fuer hauptdeputat.changed/verteilung.changed => Fall A.
SELECT
  l.event_type,
  l.status,
  l.http_status,
  count(*)                    AS anzahl,
  min(l.created_at)           AS erstes,
  max(l.created_at)           AS letztes
FROM notification_log l
GROUP BY l.event_type, l.status, l.http_status
ORDER BY l.event_type, l.status;

\echo ''
\echo '===== N3: Die letzten 30 Zustellversuche im Detail ====='
SELECT
  l.id,
  to_char(l.created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS erstellt,
  l.event_type,
  t.name                                   AS ziel,
  l.status,
  l.attempt_count                          AS versuche,
  l.http_status,
  left(coalesce(l.last_error, ''), 160)    AS fehler,
  to_char(l.next_retry_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS naechster_retry
FROM notification_log l
LEFT JOIN notification_targets t ON t.id = l.target_id
ORDER BY l.id DESC
LIMIT 30;

\echo ''
\echo '===== N4: Haengen Zustellungen im Retry fest? ====='
-- Zeilen mit status=pending und faelligem next_retry_at bedeuten: der
-- Dispatch-Cron laeuft nicht (bis v0.8.1 war der Endpoint per Middleware
-- blockiert).
SELECT
  count(*) FILTER (WHERE l.status = 'pending')                                  AS offen,
  count(*) FILTER (WHERE l.status = 'pending' AND l.next_retry_at <= now())     AS faellig,
  count(*) FILTER (WHERE l.status = 'failed')                                   AS endgueltig_fehlgeschlagen,
  count(*) FILTER (WHERE l.status = 'success')                                  AS erfolgreich
FROM notification_log l;

\echo ''
\echo '===== N5: Laeuft der Untis-Sync ueberhaupt? (letzte 10 Laeufe) ====='
SELECT
  to_char(s.sync_datum AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS zeitpunkt,
  s.schuljahr_text,
  s.anzahl_lehrer,
  s.anzahl_aenderungen,
  s.status,
  left(coalesce(s.fehler_details, ''), 120) AS fehler
FROM deputat_sync_log s
ORDER BY s.sync_datum DESC
LIMIT 10;

\echo ''
\echo '===== N6: Zaehler der letzten Sync-Laeufe (Audit) ====='
-- Zeigt u.a. verworfen_stammschule / verworfen_fehlender_term und ab v0.8
-- wechsel_neue_perioden.
SELECT
  to_char(a.zeitpunkt AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS zeitpunkt,
  a.neue_werte
FROM audit_log a
WHERE a.tabelle = 'deputat_sync_v2'
ORDER BY a.id DESC
LIMIT 5;

\echo ''
\echo '===== N7: Datenstand Periodenmodell ====='
-- Zeigt, ob 2026/27 inzwischen in der App angekommen ist.
SELECT
  d.untis_schoolyear_id                AS schuljahr,
  count(DISTINCT d.untis_term_id)      AS perioden,
  count(DISTINCT d.lehrer_id)          AS lehrkraefte,
  min(d.gueltig_von)                   AS von,
  max(d.gueltig_bis)                   AS bis
FROM deputat_pro_periode d
GROUP BY d.untis_schoolyear_id
ORDER BY d.untis_schoolyear_id;

\echo ''
\echo '===== N8a: Inhalt der bisher gesendeten Meldungen ====='
-- Zeigt, WAS gemeldet wurde. Relevant fuer die Frage, ob die Personalabteilung
-- korrekte Werte bekommen hat: Untis nummeriert TERM_IDs um, wenn Perioden
-- nachtraeglich eingeschoben werden — bis v0.8.1 konnte der Sync dadurch Werte
-- zweier VERSCHIEDENER Perioden vergleichen und einen Wechsel melden, den es
-- so nie gab.
SELECT
  l.id,
  to_char(l.created_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS erstellt,
  l.event_type,
  (l.payload ->> 'count')                       AS gemeldete_aenderungen,
  a.value ->> 'vollname'                        AS lehrkraft,
  a.value ->> 'jahr'                            AS jahr,
  a.value ->> 'monat'                           AS monat,
  (a.value -> 'perioden' -> 0 -> 'alt'  ->> 'gesamt') AS alt,
  (a.value -> 'perioden' -> -1 -> 'neu' ->> 'gesamt') AS neu,
  (a.value -> 'perioden' -> 0 ->> 'termId')     AS term_id
FROM notification_log l
CROSS JOIN LATERAL jsonb_array_elements(coalesce(l.payload -> 'aenderungen', '[]'::jsonb)) AS a(value)
WHERE l.event_type IN ('hauptdeputat.changed', 'verteilung.changed')
ORDER BY l.id, lehrkraft;

\echo ''
\echo '===== N8b: Wurden daraus Vertragsnachtraege erzeugt? ====='
SELECT
  n.status,
  count(*)          AS anzahl,
  min(n.erstellt_am) AS erster,
  max(n.erstellt_am) AS letzter
FROM deputat_nachtraege n
GROUP BY n.status
ORDER BY n.status NULLS FIRST;

\echo ''
\echo '===== N9: Eingehende API-Keys (nur Praefix, kein Klartext) ====='
SELECT
  w.id, w.name, w.endpoint_typ, w.api_key_prefix, w.aktiv,
  to_char(w.last_used_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY HH24:MI') AS zuletzt_genutzt
FROM webhook_configs w
ORDER BY w.id;
