"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pflichtstunden } from "@/db/schema";
import { pflichtstundenWertSchema, safeFormNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, sql } from "drizzle-orm";

/**
 * Speichert Pflichtstunden-Werte (Inline-Editing).
 *
 * FormData-Format:
 * - count: number (Anzahl der Eintraege)
 * - id_{index}: number (Pflichtstunden-ID)
 * - deputat_{index}: string (Dezimalzahl, z.B. "25,5")
 * - rechtsgrundlage_{index}: string (optional)
 */
export async function savePflichtstunden(formData: FormData) {
  const session = await requireWriteAccess();
  const count = safeFormNumber(formData, "count");

  if (!Number.isFinite(count) || count <= 0 || count > 50) {
    return { error: "Ungueltige Anzahl Eintraege." };
  }

  try {
    let gespeichert = 0;

    for (let i = 0; i < count; i++) {
      const id = safeFormNumber(formData, `id_${i}`);
      const deputatRaw = formData.get(`deputat_${i}`);
      const rechtsgrundlage = formData.get(`rechtsgrundlage_${i}`);

      if (!Number.isFinite(id) || id <= 0) continue;
      if (!deputatRaw || typeof deputatRaw !== "string" || !deputatRaw.trim()) continue;

      const parsed = pflichtstundenWertSchema.safeParse(deputatRaw);
      if (!parsed.success) {
        return { error: `Ungueltiger Wert in Zeile ${i + 1}: ${parsed.error.issues[0]?.message}` };
      }

      const rgStr = rechtsgrundlage && typeof rechtsgrundlage === "string" && rechtsgrundlage.trim()
        ? rechtsgrundlage.trim().slice(0, 300)
        : undefined;

      await db
        .update(pflichtstunden)
        .set({
          vollzeitDeputat: parsed.data,
          rechtsgrundlage: rgStr ?? sql`rechtsgrundlage`,
          updatedAt: sql`now()`,
        })
        .where(eq(pflichtstunden.id, id));

      gespeichert++;
    }

    await writeAuditLog("pflichtstunden", 0, "UPDATE", null, {
      anzahlGespeichert: gespeichert,
    }, session.name);

    revalidatePath("/pflichtstunden");
    revalidatePath("/stellensoll");
    return { success: true, gespeichert };
  } catch (err: unknown) {
    console.error("Fehler beim Speichern der Pflichtstunden:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Speichern. Bitte erneut versuchen." };
  }
}
