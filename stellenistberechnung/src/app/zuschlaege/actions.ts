"use server";

import { revalidatePath } from "next/cache";
import { upsertZuschlag, getZuschlaegeBySchuleUndHaushaltsjahr, getHaushaltsjahrById } from "@/lib/db/queries";
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

  // Sperre pruefen
  const hj = await getHaushaltsjahrById(haushaltsjahrId);
  if (hj?.gesperrt) {
    return { error: `Haushaltsjahr ${hj.jahr} ist gesperrt. Keine Aenderungen moeglich.` };
  }

  try {
    // Alle zuschlag_* Felder einlesen
    const entries = Array.from(formData.entries());
    const zuschlagEntries = entries.filter(([key]) => key.startsWith("zuschlag_"));

    for (const [key, value] of zuschlagEntries) {
      const zuschlagArtId = Number(key.replace("zuschlag_", ""));
      if (!Number.isInteger(zuschlagArtId) || zuschlagArtId <= 0) continue;

      // Wert mit Zod validieren — bei Fehler Benutzer informieren, NICHT still auf "0" setzen
      const wertParsed = zuschlagWertSchema.safeParse(String(value));
      if (!wertParsed.success && String(value).trim() !== "" && String(value).trim() !== "0") {
        return { error: `Ungueltiger Wert "${String(value)}" fuer Zuschlag. Bitte eine gueltige Zahl eingeben (z.B. 0,24).` };
      }
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

export async function copyZuschlaegeFromPreviousYear(formData: FormData) {
  const session = await requireWriteAccess();
  const schuleId = safeFormNumber(formData, "schuleId");
  const zielHjId = safeFormNumber(formData, "zielHaushaltsjahrId");
  const quellHjId = safeFormNumber(formData, "quellHaushaltsjahrId");

  if (
    !Number.isFinite(schuleId) || schuleId <= 0 ||
    !Number.isFinite(zielHjId) || zielHjId <= 0 ||
    !Number.isFinite(quellHjId) || quellHjId <= 0
  ) {
    return { error: "Ungueltige Parameter." };
  }

  try {
    const quellZuschlaege = await getZuschlaegeBySchuleUndHaushaltsjahr(schuleId, quellHjId);

    if (quellZuschlaege.length === 0) {
      return { error: "Keine Zuschlaege im Quell-Haushaltsjahr vorhanden." };
    }

    let kopiert = 0;
    for (const z of quellZuschlaege) {
      await upsertZuschlag({
        schuleId,
        haushaltsjahrId: zielHjId,
        zuschlagArtId: z.zuschlagArtId,
        wert: z.wert,
        zeitraum: z.zeitraum,
        bemerkung: z.bemerkung ?? undefined,
      });
      kopiert++;
    }

    await writeAuditLog("zuschlaege", schuleId, "INSERT", null, {
      aktion: "kopie_vom_vorjahr",
      schuleId,
      quellHaushaltsjahrId: quellHjId,
      zielHaushaltsjahrId: zielHjId,
      kopiertAnzahl: kopiert,
    }, session.name);

    revalidatePath("/zuschlaege");
    return { kopiert };
  } catch (err: unknown) {
    console.error("Fehler beim Kopieren der Zuschlaege:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Kopieren." };
  }
}
