-- ============================================================
-- Bergmann Benjamin (lehrer_id 81) — Verifikation Periodenmodell
-- ============================================================

\pset border 2
\pset format aligned

\echo
\echo '=== 1) Periodenwerte (deputat_pro_periode) ==='
\echo
SELECT
    untis_term_id                                                                AS term,
    untis_schoolyear_id                                                          AS sy,
    to_char(gueltig_von, 'DD.MM.YYYY') || ' - ' || to_char(gueltig_bis, 'DD.MM.YYYY') AS gueltig,
    deputat_gesamt                                                               AS gesamt,
    deputat_gym                                                                  AS gym
FROM deputat_pro_periode
WHERE lehrer_id = 81
ORDER BY untis_schoolyear_id, untis_term_id;

\echo
\echo '=== 2) Echte Wertwechsel (v_deputat_aenderungen) ==='
\echo
SELECT
    'T' || term_alt || ' -> T' || term_neu                                       AS term_wechsel,
    to_char(wirksam_ab, 'TMDy DD.MM.YYYY')                                       AS wirksam_ab,
    gesamt_alt || ' -> ' || gesamt_neu                                           AS wertwechsel,
    delta_gesamt                                                                 AS delta
FROM v_deputat_aenderungen
WHERE lehrer_id = 81
ORDER BY wirksam_ab;

\echo
\echo '=== 3) Tagesgenaue Monatswerte (v_deputat_monat_tagesgenau) — HJ 2026 ==='
\echo
SELECT
    to_char(make_date(jahr, monat, 1), 'Mon YYYY')                               AS monat,
    deputat_gesamt_tagesgenau                                                    AS tagesgenau,
    deputat_gym_tagesgenau                                                       AS gym_tagesgenau,
    tage_im_monat                                                                AS tage,
    dominante_term_id                                                            AS dom_term
FROM v_deputat_monat_tagesgenau
WHERE lehrer_id = 81 AND jahr = 2026
ORDER BY jahr, monat;

\echo
\echo '=== 4) Vergleich: tagesgenau (neu) vs deputat_monatlich (alt) — HJ 2026 ==='
\echo
SELECT
    to_char(make_date(2026, dm.monat, 1), 'Mon YYYY')                            AS monat,
    dm.deputat_gesamt                                                            AS alt_db,
    vmt.deputat_gesamt_tagesgenau                                                AS tagesgenau,
    ROUND((vmt.deputat_gesamt_tagesgenau - dm.deputat_gesamt)::numeric, 4)       AS differenz
FROM deputat_monatlich dm
JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id AND hj.jahr = 2026
LEFT JOIN v_deputat_monat_tagesgenau vmt
    ON vmt.lehrer_id = dm.lehrer_id
   AND vmt.haushaltsjahr_id = dm.haushaltsjahr_id
   AND vmt.monat = dm.monat
WHERE dm.lehrer_id = 81
ORDER BY dm.monat;
