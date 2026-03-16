/**
 * n8n Code Node: "Daten fuer Stellenist aufbereiten"
 *
 * Transformiert die Untis-Daten aus dem vorherigen MSSQL-Query
 * in das Format fuer POST /api/deputate/sync.
 *
 * Modus: Run Once for All Items
 *
 * Erwartet als Input die Items aus "Daten fuer DB vorbereiten":
 *   - TEACHER_ID, Name, PNumber, OwnSchool, Vollname
 *   - Deputat, Deputat_GES, Deputat_GYM, Deputat_BK
 *   - Schuljahr_Text, TERM_ID, DateFrom, DateTo
 */

const CONFIG = {
  // n8n-Variablen fuer API-Zugang
  apiUrl: $vars.STELLENIST_API_URL ?? "http://localhost:3000/api/deputate/sync",
  apiKey: $vars.STELLENIST_API_KEY ?? "",

  // Debug-Modus (auf true setzen fuer ausfuehrliche Logs)
  debugMode: false,

  // Maximale Anzahl Lehrer pro Sync-Call (API-Limit: 500)
  maxLehrerProCall: 500,
};

try {
  const inputItems = $input.all();

  if (inputItems.length === 0) {
    return [{ json: { error: "Keine Daten vom MSSQL-Query erhalten.", skip: true } }];
  }

  // Term-Metadaten aus dem ersten Item (alle Items haben denselben Term)
  const firstItem = inputItems[0].json;
  const termId = firstItem.TERM_ID ?? null;
  const schuljahrText = firstItem.Schuljahr_Text ?? null;
  const dateFrom = firstItem.DateFrom ?? null;
  const dateTo = firstItem.DateTo ?? null;

  if (CONFIG.debugMode) {
    console.log(`[Stellenist-Sync] ${inputItems.length} Lehrer, Term ${termId}, ${dateFrom} - ${dateTo}`);
  }

  // Lehrer-Daten transformieren
  const lehrerArray = [];
  const fehler = [];

  for (const item of inputItems) {
    const d = item.json;

    try {
      // Pflichtfelder pruefen
      if (!d.TEACHER_ID || !d.Name || !d.Vollname) {
        fehler.push(`Uebersprungen: Item ohne TEACHER_ID/Name/Vollname`);
        continue;
      }

      // Deputat-Werte sicher als Zahl parsen
      const deputat = parseFloat(d.Deputat) || 0;
      const deputatGes = parseFloat(d.Deputat_GES) || 0;
      const deputatGym = parseFloat(d.Deputat_GYM) || 0;
      const deputatBk = parseFloat(d.Deputat_BK) || 0;

      lehrerArray.push({
        teacher_id: parseInt(d.TEACHER_ID, 10),
        name: String(d.Name).substring(0, 50),
        vollname: String(d.Vollname).substring(0, 200),
        personalnummer: d.PNumber ? String(d.PNumber).substring(0, 20) : null,
        stammschule: String(d.OwnSchool ?? "").substring(0, 10),
        deputat: Math.round(deputat * 1000) / 1000,
        deputat_ges: Math.round(deputatGes * 1000) / 1000,
        deputat_gym: Math.round(deputatGym * 1000) / 1000,
        deputat_bk: Math.round(deputatBk * 1000) / 1000,
      });
    } catch (itemError) {
      fehler.push(`Fehler bei TEACHER_ID=${d.TEACHER_ID}: ${itemError.message}`);
    }
  }

  if (lehrerArray.length === 0) {
    return [{ json: { error: "Keine gueltigen Lehrer-Daten nach Transformation.", skip: true } }];
  }

  // Payload zusammenbauen
  const payload = {
    api_key: CONFIG.apiKey,
    sync_datum: new Date().toISOString().split("T")[0], // YYYY-MM-DD
    schuljahr_text: schuljahrText,
    term_id: termId ? parseInt(termId, 10) : undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
    lehrer: lehrerArray.slice(0, CONFIG.maxLehrerProCall),
  };

  if (CONFIG.debugMode) {
    console.log(`[Stellenist-Sync] Payload: ${lehrerArray.length} Lehrer, sync_datum=${payload.sync_datum}`);
    if (fehler.length > 0) {
      console.log(`[Stellenist-Sync] ${fehler.length} Fehler bei Transformation:`, fehler);
    }
  }

  // Ein einzelnes Item mit dem kompletten Payload zurueckgeben
  // Der nachfolgende HTTP Request Node sendet dieses als JSON-Body
  return [{
    json: payload,
  }];

} catch (error) {
  console.error(`[Stellenist-Sync] Kritischer Fehler: ${error.message}`);
  return [{
    json: {
      error: `Transformation fehlgeschlagen: ${error.message}`,
      skip: true,
    },
  }];
}
