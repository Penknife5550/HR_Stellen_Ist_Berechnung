"use server";

import { revalidatePath } from "next/cache";
import { upsertZuschlag } from "@/lib/db/queries";
import { zuschlagWertSchema, safeFormNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";

export async function saveZuschlaege(formData: FormData) {
  const session = await requireWriteAccess();
  const schuleId = safeFormNumber(formData, "schuleId");
  const haushaltsjahrId = safeFormNumber(formData, "haushaltsjahrId");

  if (!Number.isFinite(schuleId) || schuleId <= 0 || !Number.isFinite(haushaltsjahrId) || haushaltsjahrId <= 0) {
    return { error: "Ungueltige Schule oder Haushaltsjahr." };
  }

  try {
    // Alle zuschlag_* Felder einlesen
    const entries = Array.from(formData.entries());
    const zuschlagEntries = entries.filter(([key]) => key.startsWith("zuschlag_"));

    for (const [key, value] of zuschlagEntries) {
      const zuschlagArtId = Number(key.replace("zuschlag_", ""));
      if (!Number.isInteger(zuschlagArtId) || zuschlagArtId <= 0) continue;

      // Wert mit Zod validieren
      const wertParsed = zuschlagWertSchema.safeParse(String(value));
      const wert = wertParsed.success ? wertParsed.data : "0";

      const bemerkung = formData.get(`bemerkung_${zuschlagArtId}`);
      const bemerkungStr = bemerkung ? String(bemerkung).slice(0, 500) : undefined;

      await upsertZuschlag({
        schuleId,
        haushaltsjahrId,
        zuschlagArtId,
        wert: wert || "0",
        bemerkung: bemerkungStr || undefined,
      });
    }

    await writeAuditLog("zuschlaege", schuleId, "UPDATE", null, {
      schuleId,
      haushaltsjahrId,
      anzahlZuschlaege: zuschlagEntries.length,
    }, session.name);

    revalidatePath("/zuschlaege");
    return { success: true };
  } catch (err: unknown) {
    console.error("Fehler beim Speichern der Zuschlaege:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Speichern." };
  }
}
