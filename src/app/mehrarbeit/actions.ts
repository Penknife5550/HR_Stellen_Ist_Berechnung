"use server";

import { revalidatePath } from "next/cache";
import { upsertMehrarbeit, deleteMehrarbeit as deleteMehrarbeitQuery } from "@/lib/db/queries";
import { mehrarbeitSchema, safeFormNumber, safeFormString } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";

export async function saveMehrarbeit(formData: FormData) {
  const session = await requireWriteAccess();
  const parsed = mehrarbeitSchema.safeParse({
    lehrerId: safeFormNumber(formData, "lehrerId"),
    haushaltsjahrId: safeFormNumber(formData, "haushaltsjahrId"),
    monat: safeFormNumber(formData, "monat"),
    stunden: safeFormString(formData, "stunden"),
    schuleId: formData.get("schuleId") ? safeFormNumber(formData, "schuleId") : undefined,
    bemerkung: safeFormString(formData, "bemerkung") || undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  try {
    await upsertMehrarbeit({
      lehrerId: data.lehrerId,
      haushaltsjahrId: data.haushaltsjahrId,
      monat: data.monat,
      stunden: data.stunden,
      schuleId: data.schuleId,
      bemerkung: data.bemerkung,
    });

    await writeAuditLog("mehrarbeit", data.lehrerId, "INSERT", null, {
      lehrerId: data.lehrerId,
      monat: data.monat,
      stunden: data.stunden,
    }, session.name);

    revalidatePath("/mehrarbeit");
    return { success: true };
  } catch (err: unknown) {
    console.error("Fehler beim Speichern der Mehrarbeit:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Speichern. Bitte erneut versuchen." };
  }
}

export async function removeMehrarbeit(formData: FormData) {
  const session = await requireWriteAccess();

  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await writeAuditLog("mehrarbeit", id, "DELETE", { id }, null, session.name);
    await deleteMehrarbeitQuery(id);
    revalidatePath("/mehrarbeit");
    return { success: true };
  } catch (err: unknown) {
    console.error("Fehler beim Loeschen der Mehrarbeit:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Loeschen." };
  }
}
