/**
 * Audit-Log Hilfsfunktionen.
 * Protokolliert alle Aenderungen fuer die Bezirksregierung.
 */

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function writeAuditLog(
  tabelle: string,
  datensatzId: number,
  aktion: "INSERT" | "UPDATE" | "DELETE",
  alteWerte?: Record<string, unknown> | null,
  neueWerte?: Record<string, unknown> | null,
  benutzer?: string
) {
  try {
    await db.insert(auditLog).values({
      tabelle,
      datensatzId,
      aktion,
      alteWerte: alteWerte ?? null,
      neueWerte: neueWerte ?? null,
      benutzer: benutzer ?? "System",
    });
  } catch (err) {
    // Audit-Log-Fehler duerfen die Hauptoperation nicht blockieren
    console.error("Audit-Log Fehler:", err instanceof Error ? err.message : "Unbekannt");
  }
}
