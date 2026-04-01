"use server";

import { revalidatePath } from "next/cache";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { db } from "@/db";
import { deputatAenderungen } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";

export async function markiereAlsVersendetAction(formData: FormData) {
  const session = await requireWriteAccess();
  const aenderungId = Number(formData.get("aenderungId"));
  if (!aenderungId) return { error: "aenderungId fehlt." };

  await Promise.all([
    db
      .update(deputatAenderungen)
      .set({ nachtragStatus: "versendet" })
      .where(eq(deputatAenderungen.id, aenderungId)),
    writeAuditLog(
      "deputat_aenderungen",
      aenderungId,
      "UPDATE",
      { nachtragStatus: "erstellt" },
      { nachtragStatus: "versendet" },
      session.name
    ),
  ]);

  revalidatePath("/nachtraege");
  return { success: true, message: "Als versendet markiert." };
}

export async function resetNachtragStatusAction(formData: FormData) {
  const session = await requireWriteAccess();
  const aenderungId = Number(formData.get("aenderungId"));
  if (!aenderungId) return { error: "aenderungId fehlt." };

  // Aktuellen Status vor Update laden
  const [current] = await db
    .select({ nachtragStatus: deputatAenderungen.nachtragStatus })
    .from(deputatAenderungen)
    .where(eq(deputatAenderungen.id, aenderungId));

  const oldStatus = current?.nachtragStatus ?? null;

  await Promise.all([
    db
      .update(deputatAenderungen)
      .set({
        nachtragStatus: null,
        nachtragErstelltAm: null,
        nachtragErstelltVon: null,
      })
      .where(eq(deputatAenderungen.id, aenderungId)),
    writeAuditLog(
      "deputat_aenderungen",
      aenderungId,
      "UPDATE",
      { nachtragStatus: oldStatus },
      { nachtragStatus: null },
      session.name
    ),
  ]);

  revalidatePath("/nachtraege");
  return { success: true, message: "Status zurueckgesetzt." };
}
