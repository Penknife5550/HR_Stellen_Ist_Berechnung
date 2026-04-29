/**
 * Verifikation des Periodenmodells (sync-v2) anhand Bergmann Benjamin (TEACHER_ID 166).
 *
 * Schritt 1: Untis-Terms-Master fuer SY 2025/2026 spiegeln (18 Perioden).
 * Schritt 2: Bergmanns 18 Periodenwerte hochladen.
 * Schritt 3: Views abfragen und gegen Konzept-Erwartungen pruefen.
 *
 * Aufruf: node scripts/test-bergmann-v2.mjs
 */

const ENDPOINT_TERMS = "http://localhost:3001/api/untis-terms/sync";
const ENDPOINT_SYNC2 = "http://localhost:3001/api/deputate/sync-v2";
const API_KEY = process.env.API_SYNC_KEY ?? "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3";

// Untis-Periodendaten SY 2025/2026 — gemaess vorigem MSSQL-Output, mit
// effektivem date_to = LEAD(DateFrom)-1 (die b-Perioden T13/T16 haben echtes date_to).
const SY = 20252026;
const TERMS = [
  { term_id: 1,  term_name: "Periode1",   date_from: "25.08.2025", date_to: "14.09.2025", is_b_period: false },
  { term_id: 2,  term_name: "Periode2",   date_from: "15.09.2025", date_to: "21.09.2025", is_b_period: false },
  { term_id: 3,  term_name: "Periode3",   date_from: "22.09.2025", date_to: "05.10.2025", is_b_period: false },
  { term_id: 4,  term_name: "Periode4",   date_from: "06.10.2025", date_to: "19.10.2025", is_b_period: false },
  { term_id: 5,  term_name: "Periode5",   date_from: "20.10.2025", date_to: "02.11.2025", is_b_period: false },
  { term_id: 6,  term_name: "Periode6",   date_from: "03.11.2025", date_to: "09.11.2025", is_b_period: false },
  { term_id: 7,  term_name: "Periode7",   date_from: "10.11.2025", date_to: "16.11.2025", is_b_period: false },
  { term_id: 8,  term_name: "Periode8",   date_from: "17.11.2025", date_to: "23.11.2025", is_b_period: false },
  { term_id: 9,  term_name: "Periode9",   date_from: "24.11.2025", date_to: "04.01.2026", is_b_period: false },
  { term_id: 10, term_name: "Periode10",  date_from: "05.01.2026", date_to: "08.02.2026", is_b_period: false },
  { term_id: 11, term_name: "Periode11",  date_from: "09.02.2026", date_to: "01.03.2026", is_b_period: false },
  { term_id: 12, term_name: "Periode12",  date_from: "02.03.2026", date_to: "15.03.2026", is_b_period: false },
  { term_id: 13, term_name: "Periode12b", date_from: "16.03.2026", date_to: "12.04.2026", is_b_period: true  },
  { term_id: 14, term_name: "Periode13",  date_from: "13.04.2026", date_to: "19.04.2026", is_b_period: false },
  { term_id: 15, term_name: "Periode14",  date_from: "20.04.2026", date_to: "26.04.2026", is_b_period: false },
  { term_id: 16, term_name: "Periode14b", date_from: "27.04.2026", date_to: "03.05.2026", is_b_period: true  },
  { term_id: 17, term_name: "Periode15",  date_from: "04.05.2026", date_to: "24.05.2026", is_b_period: false },
  { term_id: 18, term_name: "Periode16",  date_from: "25.05.2026", date_to: "19.07.2026", is_b_period: false },
];

// Bergmann Benjamin — 18 Periodenwerte aus dem Untis-Teacher-Dump.
const BERGMANN_BASE = {
  teacher_id: 166,
  name: "BeB",
  vollname: "Bergmann Benjamin",
  personalnummer: "600281",
  stammschule: "GYM",
  statistik_code: "BT",
};

// PlannedWeek-Werte / 1000 = Wochenstunden je Term
const PERIODENWERTE = [
  { term_id: 1,  ws: 8.0  },
  { term_id: 2,  ws: 8.0  },
  { term_id: 3,  ws: 8.0  },
  { term_id: 4,  ws: 8.0  },
  { term_id: 5,  ws: 8.0  },
  { term_id: 6,  ws: 10.0 },
  { term_id: 7,  ws: 10.0 },
  { term_id: 8,  ws: 10.0 },
  { term_id: 9,  ws: 10.0 },
  { term_id: 10, ws: 10.0 },
  { term_id: 11, ws: 17.0 },
  { term_id: 12, ws: 17.0 },
  { term_id: 13, ws: 17.0 },
  { term_id: 14, ws: 10.0 },
  { term_id: 15, ws: 10.0 },
  { term_id: 16, ws: 10.0 },
  { term_id: 17, ws: 16.0 },
  { term_id: 18, ws: 16.0 },
];

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

async function main() {
  const today = new Date();
  const sync_datum = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Schritt 1: Untis-Terms spiegeln
  console.log("=== Schritt 1: Untis-Terms spiegeln ===");
  const termsPayload = {
    api_key: API_KEY,
    sync_datum,
    terms: TERMS.map((t) => ({ school_year_id: SY, ...t })),
  };
  const termsRes = await postJson(ENDPOINT_TERMS, termsPayload);
  console.log(`HTTP ${termsRes.status}:`, termsRes.body);
  if (!termsRes.ok) {
    console.error("Terms-Sync fehlgeschlagen");
    process.exit(1);
  }

  // Schritt 2: Bergmann-Periodenwerte
  console.log("\n=== Schritt 2: Bergmann via sync-v2 ===");
  const eintraege = PERIODENWERTE.map((p) => ({
    ...BERGMANN_BASE,
    school_year_id: SY,
    term_id: p.term_id,
    deputat_gesamt: p.ws,
    deputat_ges: 0,
    deputat_gym: p.ws,    // BeB ist GYM, der gesamte Wert ist GYM-Deputat
    deputat_bk: 0,
  }));
  const syncRes = await postJson(ENDPOINT_SYNC2, {
    api_key: API_KEY,
    sync_datum,
    schuljahr_text: "2025/2026",
    eintraege,
  });
  console.log(`HTTP ${syncRes.status}:`, syncRes.body);
  if (!syncRes.ok) {
    console.error("Sync-v2 fehlgeschlagen");
    process.exit(1);
  }

  console.log("\nFertig — pruefen mit docs/bergmann_v2_check.sql");
}

main().catch((e) => { console.error(e); process.exit(1); });
