/**
 * Backfill aller Lehrer ins Periodenmodell (deputat_pro_periode) aus dem
 * existierenden Datendump C:/Users/driesen.FES/Downloads/lehhrer.txt.
 *
 * Schritt 1: Untis-Terms-Master aus den unique (sy, term, dateFrom, dateTo)
 *            in den Daten ableiten und nach /api/untis-terms/sync schicken.
 * Schritt 2: Pro Zeile einen Eintrag fuer /api/deputate/sync-v2 bauen
 *            und in einem Aufruf hochladen.
 *
 * Aufruf: node scripts/backfill-v2-from-lehhrer-txt.mjs [<pfad>]
 */

import fs from "node:fs";

const INPUT = process.argv[2] ?? "C:/Users/driesen.FES/Downloads/lehhrer.txt";
const ENDPOINT_TERMS = "http://localhost:3001/api/untis-terms/sync";
const ENDPOINT_SYNC2 = "http://localhost:3001/api/deputate/sync-v2";
const API_KEY = process.env.API_SYNC_KEY ?? "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3";
const BATCH_SIZE = 2000;

const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
console.log(`Eingelesen: ${raw.length} Zeilen aus ${INPUT}`);

// 1) Eindeutige Terms ableiten
const termsMap = new Map();
for (const r of raw) {
  const key = `${r.SCHOOLYEAR_ID}|${r.TERM_ID}`;
  if (termsMap.has(key)) continue;
  termsMap.set(key, {
    school_year_id: r.SCHOOLYEAR_ID,
    term_id: r.TERM_ID,
    term_name: r.Term_Name ?? null,
    date_from: r.DateFrom_Formatted,
    date_to: r.DateTo_Formatted,
    is_b_period: false, // lehhrer.txt enthaelt diese Info nicht
  });
}
const terms = [...termsMap.values()].sort((a, b) =>
  a.school_year_id !== b.school_year_id
    ? a.school_year_id - b.school_year_id
    : a.term_id - b.term_id,
);
console.log(`Eindeutige Terms: ${terms.length}`);

// 2) Pro (lehrer × term) einen Eintrag (n8n-Code-Node-Mapping nachbilden)
const eintraege = raw.map((r) => ({
  teacher_id: parseInt(r.TEACHER_ID, 10),
  name: String(r.Name).substring(0, 50),
  vollname: String(r.Vollname).substring(0, 200),
  personalnummer: r.Personalnummer ? String(r.Personalnummer).substring(0, 20).trim() : null,
  stammschule: String(r.Stammschule ?? "").substring(0, 10),
  statistik_code: r.Statistik_Code
    ? String(r.Statistik_Code).substring(0, 5).trim().toUpperCase()
    : null,
  school_year_id: r.SCHOOLYEAR_ID,
  term_id: r.TERM_ID,
  deputat_gesamt: Math.round((parseFloat(r.Deputat) || 0) * 1000) / 1000,
  deputat_ges: Math.round((parseFloat(r.Deputat_GES) || 0) * 1000) / 1000,
  deputat_gym: Math.round((parseFloat(r.Deputat_GYM) || 0) * 1000) / 1000,
  deputat_bk: Math.round((parseFloat(r.Deputat_BK) || 0) * 1000) / 1000,
}));
console.log(`Eintraege total: ${eintraege.length}`);

const today = new Date();
const sync_datum = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, ok: res.ok, body: parsed };
}

console.log("\n=== Schritt 1: Untis-Terms spiegeln ===");
const termsRes = await postJson(ENDPOINT_TERMS, {
  api_key: API_KEY,
  sync_datum,
  terms,
});
console.log(`HTTP ${termsRes.status}:`, termsRes.body);
if (!termsRes.ok) process.exit(1);

console.log("\n=== Schritt 2: deputat_pro_periode hochladen ===");
let totalNew = 0, totalUpd = 0, totalProcessed = 0, totalDiscarded = 0;
const totalBatches = Math.ceil(eintraege.length / BATCH_SIZE);
for (let i = 0; i < eintraege.length; i += BATCH_SIZE) {
  const batch = eintraege.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  process.stdout.write(`Batch ${batchNum}/${totalBatches} (${batch.length} Eintraege)... `);

  const res = await postJson(ENDPOINT_SYNC2, {
    api_key: API_KEY,
    sync_datum,
    schuljahr_text: "Backfill v2",
    eintraege: batch,
  });
  if (!res.ok) {
    console.log(`FEHLER HTTP ${res.status}:`, res.body);
    process.exit(1);
  }
  console.log(`OK (${res.body.perioden_eintraege_neu} neu, ${res.body.perioden_eintraege_aktualisiert} upd, ${res.body.verworfen_stammschule + res.body.verworfen_fehlender_term} verworfen)`);
  totalNew += res.body.perioden_eintraege_neu;
  totalUpd += res.body.perioden_eintraege_aktualisiert;
  totalProcessed += res.body.verarbeitet;
  totalDiscarded += res.body.verworfen_stammschule + res.body.verworfen_fehlender_term;
}

console.log(`\nFertig: ${totalProcessed} verarbeitet (${totalNew} neu, ${totalUpd} aktualisiert), ${totalDiscarded} verworfen.`);
