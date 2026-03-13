"use server";

import { revalidatePath } from "next/cache";
import { upsertSlrWert, getSlrWerteBySchuljahr } from "@/lib/db/queries";
import { slrWertSchema, safeFormNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";

/**
 * Speichert SLR-Werte fuer ein Schuljahr (Inline-Editing).
 *
 * FormData-Format:
 * - schuljahrId: number
 * - slr_{index}: string (Dezimalzahl, z.B. "18,63")
 * - typ_{index}: string (Schulform-Typ, z.B. "Gesamtschule Sek I")
 * - quelle_{index}: string (optional, z.B. "VO zu § 93 Abs. 2 SchulG 2025/2026")
 * - count: number (Anzahl der Eintraege)
 */
export async function saveSlrWerte(formData: FormData) {
  const session = await requireWriteAccess();
  const schuljahrId = safeFormNumber(formData, "schuljahrId");
  const count = safeFormNumber(formData, "count");

  if (!Number.isFinite(schuljahrId) || schuljahrId <= 0) {
    return { error: "Ungueltiges Schuljahr." };
  }

  if (!Number.isFinite(count) || count <= 0 || count > 50) {
    return { error: "Ungueltige Anzahl SLR-Eintraege." };
  }

  try {
    let gespeichert = 0;

    for (let i = 0; i < count; i++) {
      const schulformTyp = formData.get(`typ_${i}`);
      const slrRaw = formData.get(`slr_${i}`);
      const quelle = formData.get(`quelle_${i}`);

      if (!schulformTyp || typeof schulformTyp !== "string" || !schulformTyp.trim()) continue;
      if (!slrRaw || typeof slrRaw !== "string" || !slrRaw.trim()) continue;

      // SLR-Wert validieren (Komma → Punkt, max 2 Dezimalstellen)
      const parsed = slrWertSchema.safeParse(slrRaw);
      if (!parsed.success) {
        return { error: `Ungueltiger SLR-Wert fuer "${schulformTyp}": ${parsed.error.issues[0]?.message}` };
      }

      const quelleStr = quelle && typeof quelle === "string" && quelle.trim()
        ? quelle.trim().slice(0, 200)
        : undefined;

      await upsertSlrWert({
        schuljahrId,
        schulformTyp: schulformTyp.trim(),
        relation: parsed.data,
        quelle: quelleStr,
      });

      gespeichert++;
    }

    await writeAuditLog("slr_werte", 0, "UPDATE", null, {
      schuljahrId,
      anzahlGespeichert: gespeichert,
    }, session.name);

    revalidatePath("/slr-konfiguration");
    return { success: true, gespeichert };
  } catch (err: unknown) {
    console.error("Fehler beim Speichern der SLR-Werte:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Speichern der SLR-Werte." };
  }
}

/**
 * Kopiert SLR-Werte vom Vorjahr in ein neues Schuljahr.
 *
 * FormData-Format:
 * - zielSchuljahrId: number (das Schuljahr, das befuellt werden soll)
 * - quellSchuljahrId: number (das Schuljahr, von dem kopiert wird)
 */
export async function copySlrFromPreviousYear(formData: FormData) {
  const session = await requireWriteAccess();
  const zielSchuljahrId = safeFormNumber(formData, "zielSchuljahrId");
  const quellSchuljahrId = safeFormNumber(formData, "quellSchuljahrId");

  if (!Number.isFinite(zielSchuljahrId) || zielSchuljahrId <= 0) {
    return { error: "Ungueltiges Ziel-Schuljahr." };
  }
  if (!Number.isFinite(quellSchuljahrId) || quellSchuljahrId <= 0) {
    return { error: "Ungueltiges Quell-Schuljahr." };
  }

  try {
    const quellWerte = await getSlrWerteBySchuljahr(quellSchuljahrId);

    if (quellWerte.length === 0) {
      return { error: "Kein Vorjahr mit SLR-Werten gefunden." };
    }

    for (const wert of quellWerte) {
      await upsertSlrWert({
        schuljahrId: zielSchuljahrId,
        schulformTyp: wert.schulformTyp,
        relation: wert.relation,
        quelle: wert.quelle ?? undefined,
      });
    }

    await writeAuditLog("slr_werte", 0, "INSERT", null, {
      zielSchuljahrId,
      quellSchuljahrId,
      anzahlKopiert: quellWerte.length,
    }, session.name);

    revalidatePath("/slr-konfiguration");
    return { success: true, kopiert: quellWerte.length };
  } catch (err: unknown) {
    console.error("Fehler beim Kopieren der SLR-Werte:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Kopieren der SLR-Werte." };
  }
}
