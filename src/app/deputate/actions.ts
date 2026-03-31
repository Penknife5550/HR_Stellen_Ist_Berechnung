"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { deputatAenderungen } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { z } from "zod";

const datumKorrekturSchema = z.object({
  aenderungId: z.number().int().positive(),
  tatsaechlichesDatum: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Format: JJJJ-MM-TT"
  ),
});

/**
 * Tatsaechliches Aenderungsdatum korrigieren.
 *
 * Untis erzwingt Aenderungen immer zum Montag. Das reale Datum
 * kann abweichen und muss fuer die korrekte Refinanzierung
 * nach § 3 Abs. 1 FESchVO taggenau erfasst werden.
 */
export async function korrigiereDatumAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    aenderungId: Number(formData.get("aenderungId")),
    tatsaechlichesDatum: String(formData.get("tatsaechlichesDatum") ?? ""),
  };

  const parsed = datumKorrekturSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltiges Datum." };
  }

  const { aenderungId, tatsaechlichesDatum } = parsed.data;

  // Bestehenden Eintrag laden
  const [existing] = await db
    .select()
    .from(deputatAenderungen)
    .where(eq(deputatAenderungen.id, aenderungId));

  if (!existing) {
    return { error: "Aenderungseintrag nicht gefunden." };
  }

  // Datum aktualisieren
  await db
    .update(deputatAenderungen)
    .set({
      tatsaechlichesDatum,
      datumKorrigiertVon: session.name,
      datumKorrigiertAm: new Date(),
    })
    .where(eq(deputatAenderungen.id, aenderungId));

  await writeAuditLog("deputat_aenderungen", aenderungId, "UPDATE", {
    tatsaechlichesDatum: existing.tatsaechlichesDatum,
  }, {
    tatsaechlichesDatum,
    korrigiertVon: session.name,
  }, session.name);

  revalidatePath(`/deputate/${existing.lehrerId}`);
  revalidatePath("/deputate");

  return { success: true, message: "Tatsaechliches Datum gespeichert." };
}
