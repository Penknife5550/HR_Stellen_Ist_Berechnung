/**
 * Lokaler Import: Untis-Rohdaten -> /api/deputate/sync
 *
 * Repliziert exakt das n8n Code-Node-Mapping (#223 v0.6.0).
 * Pro (school_year_id, term_id) ein POST.
 *
 * Aufruf:
 *   node scripts/import-lehrer-local.mjs <pfad-zur-json>
 */

import fs from "node:fs";

const INPUT = process.argv[2] ?? "C:/Users/driesen.FES/Downloads/lehhrer.txt";
const ENDPOINT = process.env.SYNC_ENDPOINT ?? "http://localhost:3001/api/deputate/sync";
const API_KEY = process.env.API_SYNC_KEY;
if (!API_KEY) {
  console.error("FEHLER: API_SYNC_KEY env var nicht gesetzt.");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));
console.log(`Eingelesen: ${raw.length} Zeilen aus ${INPUT}`);

// Gruppieren pro Periode
const groups = new Map();
for (const r of raw) {
  const key = `${r.SCHOOLYEAR_ID}|${r.TERM_ID}`;
  if (!groups.has(key)) {
    groups.set(key, {
      school_year_id: r.SCHOOLYEAR_ID,
      term_id: r.TERM_ID,
      schuljahr_text: r.Schuljahr_Text,
      date_from: r.DateFrom_Formatted,
      date_to: r.DateTo_Formatted,
      lehrer: [],
    });
  }
  const g = groups.get(key);
  g.lehrer.push({
    teacher_id: parseInt(r.TEACHER_ID, 10),
    name: String(r.Name).substring(0, 50),
    vollname: String(r.Vollname).substring(0, 200),
    personalnummer: r.Personalnummer ? String(r.Personalnummer).substring(0, 20).trim() : null,
    stammschule: String(r.Stammschule ?? "").substring(0, 10),
    deputat: Math.round((parseFloat(r.Deputat) || 0) * 1000) / 1000,
    deputat_ges: Math.round((parseFloat(r.Deputat_GES) || 0) * 1000) / 1000,
    deputat_gym: Math.round((parseFloat(r.Deputat_GYM) || 0) * 1000) / 1000,
    deputat_bk: Math.round((parseFloat(r.Deputat_BK) || 0) * 1000) / 1000,
    statistik_code: r.Statistik_Code
      ? String(r.Statistik_Code).substring(0, 5).trim().toUpperCase()
      : null,
  });
}

const periods = [...groups.values()].sort((a, b) => {
  if (a.school_year_id !== b.school_year_id) return a.school_year_id - b.school_year_id;
  return a.term_id - b.term_id;
});

console.log(`Perioden: ${periods.length}`);
console.log(`Endpoint: ${ENDPOINT}\n`);

const today = new Date();
const sync_datum = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

let ok = 0;
let fail = 0;
let totalLehrerSent = 0;

for (const p of periods) {
  const payload = {
    api_key: API_KEY,
    sync_datum,
    schuljahr_text: p.schuljahr_text,
    school_year_id: p.school_year_id,
    term_id: p.term_id,
    date_from: p.date_from,
    date_to: p.date_to,
    lehrer: p.lehrer,
  };
  const tag = `${p.school_year_id} T${String(p.term_id).padStart(2, "0")} (${p.date_from}–${p.date_to}, ${p.lehrer.length} Lehrer)`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) {
      ok++;
      totalLehrerSent += p.lehrer.length;
      console.log(`✓ ${tag}  ${text.length < 200 ? text : `(${text.length}b)`}`);
    } else {
      fail++;
      console.log(`✗ ${tag}  HTTP ${res.status}: ${text}`);
    }
  } catch (e) {
    fail++;
    console.log(`✗ ${tag}  ERROR: ${e.message}`);
  }
}

console.log(`\nFertig: ${ok} OK, ${fail} fehlgeschlagen, ${totalLehrerSent} Lehrer-Einträge gesendet.`);
process.exit(fail ? 1 : 0);
