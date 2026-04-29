-- Erweitert v_deputat_pro_tag, sodass die Tages-Reihe bis zum Ende des
-- spaetesten haushaltsjahres reicht. Damit greift die Fortschreibung des
-- letzten bekannten Werts auch in Monaten, in denen Untis noch keine
-- Periodendaten geliefert hat (typisch: Aug-Dez nach Schuljahresende
-- bevor das neue Schuljahr in Untis angelegt ist).
--
-- Spaltenliste und Datentypen bleiben unveraendert — CREATE OR REPLACE
-- VIEW ohne DROP. Die abhaengige View v_deputat_monat_tagesgenau ist
-- damit ebenfalls automatisch erweitert.
CREATE OR REPLACE VIEW "v_deputat_pro_tag" AS
WITH tage AS (
	SELECT generate_series(
		COALESCE((SELECT MIN(gueltig_von) FROM deputat_pro_periode), CURRENT_DATE),
		GREATEST(
			COALESCE((SELECT MAX(gueltig_bis) FROM deputat_pro_periode), CURRENT_DATE),
			COALESCE((SELECT MAX(make_date(jahr, 12, 31)) FROM haushaltsjahre), CURRENT_DATE)
		),
		INTERVAL '1 day'
	)::date AS tag
),
lehrer_aktiv AS (
	SELECT DISTINCT lehrer_id FROM deputat_pro_periode
)
SELECT
	t.tag,
	la.lehrer_id,
	letzte.deputat_gesamt,
	letzte.deputat_ges,
	letzte.deputat_gym,
	letzte.deputat_bk,
	letzte.untis_schoolyear_id,
	letzte.untis_term_id,
	(t.tag BETWEEN letzte.gueltig_von AND letzte.gueltig_bis) AS in_periode
FROM tage t
CROSS JOIN lehrer_aktiv la
CROSS JOIN LATERAL (
	SELECT dpp.gueltig_von, dpp.gueltig_bis,
	       dpp.deputat_gesamt, dpp.deputat_ges, dpp.deputat_gym, dpp.deputat_bk,
	       dpp.untis_schoolyear_id, dpp.untis_term_id
	FROM deputat_pro_periode dpp
	WHERE dpp.lehrer_id = la.lehrer_id
	  AND dpp.gueltig_von <= t.tag
	ORDER BY dpp.gueltig_von DESC
	LIMIT 1
) letzte;
