/**
 * Cleanup-Script fuer Flip-Flop-Eintraege in deputat_aenderungen.
 *
 * Hintergrund:
 * Bis Migration 0005 erzeugte der Sync-Endpoint bei ueberlappenden
 * Untis-Perioden pro Lauf mehrere invertierte History-Eintraege
 * (A→B unmittelbar gefolgt von B→A innerhalb derselben Sync-Minute).
 * Dieses Script loescht exakte Inverse-Paare — konservativ, nur wenn
 * alle Werte korrekt invertiert sind.
 *
 * Ausfuehren:
 *   docker exec stellenist-app node cleanup-flipflop-history.mjs            # dry-run
 *   docker exec stellenist-app node cleanup-flipflop-history.mjs --apply    # echte Loeschung
 *
 * Nutzt nur `postgres` (Production-Dependency). Kein TypeScript noetig.
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const sql = postgres(DATABASE_URL, { max: 1 });

try {
  console.log(`=== Flip-Flop History Cleanup (${apply ? "APPLY" : "DRY-RUN"}) ===\n`);

  // Exakte Inverse-Paare innerhalb einer Sync-Minute identifizieren.
  // Kriterien:
  //   - selber lehrer_id, haushaltsjahr_id, monat
  //   - geaendert_am im gleichen minute-bucket (+- kein "exakt gleich",
  //     da die Transaktionen Millisekunden auseinander liegen)
  //   - alt/neu-Werte vertauscht: a.alt == b.neu UND a.neu == b.alt
  //   - term_id_alt/neu vertauscht
  const paare = await sql`
    WITH kandidaten AS (
      SELECT
        a.id AS a_id,
        b.id AS b_id,
        a.lehrer_id,
        a.haushaltsjahr_id,
        a.monat,
        a.geaendert_am AS a_zeit,
        b.geaendert_am AS b_zeit,
        a.deputat_gesamt_alt AS a_alt,
        a.deputat_gesamt_neu AS a_neu,
        b.deputat_gesamt_alt AS b_alt,
        b.deputat_gesamt_neu AS b_neu,
        a.term_id_alt AS a_term_alt,
        a.term_id_neu AS a_term_neu,
        b.term_id_alt AS b_term_alt,
        b.term_id_neu AS b_term_neu
      FROM deputat_aenderungen a
      JOIN deputat_aenderungen b ON (
        b.id > a.id
        AND b.lehrer_id = a.lehrer_id
        AND b.haushaltsjahr_id = a.haushaltsjahr_id
        AND b.monat = a.monat
        AND abs(extract(epoch from (b.geaendert_am - a.geaendert_am))) <= 120
      )
      WHERE
        -- Werte exakt invertiert
        a.deputat_gesamt_alt = b.deputat_gesamt_neu
        AND a.deputat_gesamt_neu = b.deputat_gesamt_alt
        AND COALESCE(a.deputat_ges_alt, 0)  = COALESCE(b.deputat_ges_neu, 0)
        AND COALESCE(a.deputat_ges_neu, 0)  = COALESCE(b.deputat_ges_alt, 0)
        AND COALESCE(a.deputat_gym_alt, 0)  = COALESCE(b.deputat_gym_neu, 0)
        AND COALESCE(a.deputat_gym_neu, 0)  = COALESCE(b.deputat_gym_alt, 0)
        AND COALESCE(a.deputat_bk_alt, 0)   = COALESCE(b.deputat_bk_neu, 0)
        AND COALESCE(a.deputat_bk_neu, 0)   = COALESCE(b.deputat_bk_alt, 0)
        -- Term-IDs invertiert (erlaubt NULL auf beiden Seiten)
        AND (a.term_id_alt IS NOT DISTINCT FROM b.term_id_neu)
        AND (a.term_id_neu IS NOT DISTINCT FROM b.term_id_alt)
    )
    SELECT * FROM kandidaten ORDER BY a_zeit DESC
  `;

  if (paare.length === 0) {
    console.log("Keine Flip-Flop-Paare gefunden.");
    process.exit(0);
  }

  // Kurze Zusammenfassung (erste 20 Zeilen)
  console.log(`${paare.length} Flip-Flop-Paar(e) gefunden. Beispiele:`);
  for (const p of paare.slice(0, 10)) {
    console.log(
      `  lehrer=${p.lehrer_id} hj=${p.haushaltsjahr_id} monat=${p.monat}  ` +
      `${p.a_alt}→${p.a_neu} (term ${p.a_term_alt}→${p.a_term_neu}) + ` +
      `${p.b_alt}→${p.b_neu} (term ${p.b_term_alt}→${p.b_term_neu})  ` +
      `@ ${new Date(p.a_zeit).toISOString()}`
    );
  }
  if (paare.length > 10) {
    console.log(`  ... (+${paare.length - 10} weitere)`);
  }

  const idsZuLoeschen = paare.flatMap((p) => [p.a_id, p.b_id]);

  if (!apply) {
    console.log(`\nDRY-RUN: ${idsZuLoeschen.length} Zeilen wuerden geloescht.`);
    console.log("Mit --apply ausfuehren, um Loeschung durchzufuehren.");
    process.exit(0);
  }

  const result = await sql`
    DELETE FROM deputat_aenderungen
    WHERE id IN ${sql(idsZuLoeschen)}
  `;
  console.log(`\n${result.count} Zeilen geloescht.`);
} catch (err) {
  console.error("Cleanup fehlgeschlagen:", err);
  process.exit(1);
} finally {
  await sql.end();
}
