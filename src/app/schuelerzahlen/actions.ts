"use server";

import { revalidatePath } from "next/cache";
import { upsertSchuelerzahl, deleteSchuelerzahl } from "@/lib/db/queries";
import { schuelerzahlSchema, safeFormNumber, safeFormString } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";

export async function saveSchuelerzahl(formData: FormData) {
  const session = await requireWriteAccess();

  const parsed = schuelerzahlSchema.safeParse({
    schuleId: safeFormNumber(formData, "schuleId"),
    schulStufeId: safeFormNumber(formData, "schulStufeId"),
    stichtag: safeFormString(formData, "stichtag"),
    anzahl: safeFormNumber(formData, "anzahl"),
    bemerkung: safeFormString(formData, "bemerkung") || undefined,
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  try {
    const result = await upsertSchuelerzahl({
      schuleId: data.schuleId,
      schulStufeId: data.schulStufeId,
      stichtag: data.stichtag,
      anzahl: data.anzahl,
      bemerkung: data.bemerkung,
      erfasstVon: session.name,
    });

    await writeAuditLog("schuelerzahlen", result?.id ?? 0, "INSERT", null, {
      schuleId: data.schuleId,
      stichtag: data.stichtag,
      anzahl: data.anzahl,
    }, session.name);

    revalidatePath("/schuelerzahlen");
    return { success: true };
  } catch (err: unknown) {
    console.error("Fehler beim Speichern der Schuelerzahl:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Speichern. Bitte erneut versuchen." };
  }
}

export async function removeSchuelerzahl(formData: FormData) {
  const session = await requireWriteAccess();

  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await writeAuditLog("schuelerzahlen", id, "DELETE", { id }, null, session.name);
    await deleteSchuelerzahl(id);
    revalidatePath("/schuelerzahlen");
    return { success: true };
  } catch (err: unknown) {
    console.error("Fehler beim Loeschen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Loeschen." };
  }
}
