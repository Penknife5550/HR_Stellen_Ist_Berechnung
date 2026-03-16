/**
 * Test-Script: Simuliert einen n8n-Sync-Call an POST /api/deputate/sync
 *
 * Sendet realistische Lehrer-/Deputatsdaten, wie sie auch aus Untis kommen wuerden.
 * Verwendung: npx tsx scripts/test-sync-api.ts
 *
 * Voraussetzung: Dev-Server muss laufen (npm run dev)
 */

const API_URL = "http://localhost:3000/api/deputate/sync";
const API_KEY = "credo-sync-key-2026";

// Realistische Testdaten: 12 Lehrkraefte mit Deputaten ueber 3 Schulen
const testPayload = {
  api_key: API_KEY,
  sync_datum: "2026-03-16",
  schuljahr_text: "2025/2026",
  term_id: 3,
  date_from: "01.02.2026",
  date_to: "30.06.2026",
  lehrer: [
    // GES-Lehrkraefte (Stammschule GES)
    {
      teacher_id: 101,
      name: "Mue",
      vollname: "Mueller, Andreas",
      personalnummer: "P1001",
      stammschule: "GES",
      deputat: 25.5,
      deputat_ges: 25.5,
      deputat_gym: 0,
      deputat_bk: 0,
    },
    {
      teacher_id: 102,
      name: "Sch",
      vollname: "Schmidt, Petra",
      personalnummer: "P1002",
      stammschule: "GES",
      deputat: 20.0,
      deputat_ges: 16.0,
      deputat_gym: 4.0,
      deputat_bk: 0,
    },
    {
      teacher_id: 103,
      name: "Fis",
      vollname: "Fischer, Thomas",
      personalnummer: "P1003",
      stammschule: "GES",
      deputat: 25.5,
      deputat_ges: 22.0,
      deputat_gym: 3.5,
      deputat_bk: 0,
    },
    {
      teacher_id: 104,
      name: "Web",
      vollname: "Weber, Claudia",
      personalnummer: "P1004",
      stammschule: "GES",
      deputat: 18.0,
      deputat_ges: 18.0,
      deputat_gym: 0,
      deputat_bk: 0,
    },
    {
      teacher_id: 105,
      name: "Bau",
      vollname: "Baumann, Stefan",
      personalnummer: "P1005",
      stammschule: "GES",
      deputat: 25.5,
      deputat_ges: 20.5,
      deputat_gym: 5.0,
      deputat_bk: 0,
    },
    // GYM-Lehrkraefte (Stammschule GYM)
    {
      teacher_id: 201,
      name: "Mey",
      vollname: "Meyer, Katharina",
      personalnummer: "P2001",
      stammschule: "GYM",
      deputat: 25.5,
      deputat_ges: 0,
      deputat_gym: 25.5,
      deputat_bk: 0,
    },
    {
      teacher_id: 202,
      name: "Hof",
      vollname: "Hoffmann, Martin",
      personalnummer: "P2002",
      stammschule: "GYM",
      deputat: 25.5,
      deputat_ges: 3.0,
      deputat_gym: 22.5,
      deputat_bk: 0,
    },
    {
      teacher_id: 203,
      name: "Kra",
      vollname: "Krause, Sabine",
      personalnummer: "P2003",
      stammschule: "GYM",
      deputat: 14.0,
      deputat_ges: 0,
      deputat_gym: 14.0,
      deputat_bk: 0,
    },
    {
      teacher_id: 204,
      name: "Ric",
      vollname: "Richter, Frank",
      personalnummer: "P2004",
      stammschule: "GYM",
      deputat: 25.5,
      deputat_ges: 2.0,
      deputat_gym: 21.5,
      deputat_bk: 2.0,
    },
    // BK-Lehrkraefte (Stammschule BK)
    {
      teacher_id: 301,
      name: "Leh",
      vollname: "Lehmann, Birgit",
      personalnummer: "P3001",
      stammschule: "BK",
      deputat: 25.5,
      deputat_ges: 0,
      deputat_gym: 0,
      deputat_bk: 25.5,
    },
    {
      teacher_id: 302,
      name: "Koe",
      vollname: "Koenig, Juergen",
      personalnummer: "P3002",
      stammschule: "BK",
      deputat: 20.0,
      deputat_ges: 0,
      deputat_gym: 2.0,
      deputat_bk: 18.0,
    },
    {
      teacher_id: 303,
      name: "Wal",
      vollname: "Walter, Susanne",
      personalnummer: "P3003",
      stammschule: "BK",
      deputat: 12.5,
      deputat_ges: 0,
      deputat_gym: 0,
      deputat_bk: 12.5,
    },
  ],
};

async function runTest() {
  console.log("=== n8n Sync API Test ===\n");
  console.log(`URL: ${API_URL}`);
  console.log(`Lehrer: ${testPayload.lehrer.length}`);
  console.log(`Zeitraum: ${testPayload.date_from} - ${testPayload.date_to}`);
  console.log(`Schuljahr: ${testPayload.schuljahr_text}\n`);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Sync erfolgreich!");
      console.log(`   Verarbeitet: ${data.verarbeitet} Lehrer`);
      console.log(`   Fehler: ${data.fehler}`);
      console.log(`   Monate: ${data.monate}`);
      console.log(`   Nachricht: ${data.message}`);
    } else {
      console.log(`❌ Fehler (HTTP ${response.status}):`);
      console.log(`   ${data.error}`);
    }

    // Test 2: Falsche API-Key
    console.log("\n--- Test 2: Falscher API-Key ---");
    const badKeyResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...testPayload, api_key: "wrong-key" }),
    });
    const badKeyData = await badKeyResponse.json();
    console.log(
      badKeyResponse.status === 401
        ? `✅ Korrekt abgelehnt (401): ${badKeyData.error}`
        : `❌ Unerwarteter Status: ${badKeyResponse.status}`
    );

    // Test 3: Leeres Lehrer-Array
    console.log("\n--- Test 3: Leeres Lehrer-Array ---");
    const emptyResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...testPayload, lehrer: [] }),
    });
    const emptyData = await emptyResponse.json();
    console.log(
      emptyResponse.status === 400
        ? `✅ Korrekt abgelehnt (400): ${emptyData.error}`
        : `❌ Unerwarteter Status: ${emptyResponse.status}`
    );

    console.log("\n=== Tests abgeschlossen ===");
  } catch (err) {
    console.error("❌ Verbindungsfehler - laeuft der Dev-Server?");
    console.error(`   ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

runTest();
