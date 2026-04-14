"use server";

import { revalidatePath } from "next/cache";
import {
  upsertMehrarbeit,
  deleteMehrarbeit as deleteMehrarbeitQuery,
  upsertMehrarbeitSchule,
  upsertMehrarbeitSchuleBemerkung,
} from "@/lib/db/queries";
import { mehrarbeitSchema, safeFormNumber, safeFormString } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { z } from "zod";

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
  if (!data.schuleId) {
    return { error: "Schule ist erforderlich fuer Lehrer-Mehrarbeit." };
  }

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

// ============================================================
// Schul-Mehrarbeit (Stellenanteile)
// ============================================================

const mehrarbeitSchuleSchema = z.object({
  schuleId: z.number().int().positive(),
  haushaltsjahrId: z.number().int().positive(),
  monat: z.number().int().min(1).max(12),
  stellenanteil: z
    .string()
    .transform((v) => v.replace(",", "."))
    .refine((v) => !isNaN(Number(v)), "Ungueltige Zahl")
    .refine((v) => Number(v) >= 0, "Wert darf nicht negativ sein")
    .refine((v) => Number(v) <= 10, "Wert unplausibel (max 10 Stellen/Monat)"),
});

export async function saveMehrarbeitSchuleAction(formData: FormData) {
  const session = await requireWriteAccess();
  const parsed = mehrarbeitSchuleSchema.safeParse({
    schuleId: safeFormNumber(formData, "schuleId"),
    haushaltsjahrId: safeFormNumber(formData, "haushaltsjahrId"),
    monat: safeFormNumber(formData, "monat"),
    stellenanteil: safeFormString(formData, "stellenanteil", 20),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  try {
    const result = await upsertMehrarbeitSchule(parsed.data);
    if (result.action !== "noop") {
      const auditAktion =
        result.action === "insert" ? "INSERT" :
        result.action === "update" ? "UPDATE" : "DELETE";
      await writeAuditLog(
        "mehrarbeit",
        result.id ?? 0,
        auditAktion,
        null,
        { schul: true, ...parsed.data },
        session.name,
      );
    }
    revalidatePath("/mehrarbeit");
    revalidatePath("/stellenist");
    return { success: true };
  } catch (err) {
    console.error("saveMehrarbeitSchule:", err instanceof Error ? err.message : err);
    return { error: "Fehler beim Speichern." };
  }
}

export async function saveMehrarbeitSchuleBemerkungAction(formData: FormData) {
  const session = await requireWriteAccess();
  const schuleId = safeFormNumber(formData, "schuleId");
  const haushaltsjahrId = safeFormNumber(formData, "haushaltsjahrId");
  const bemerkung = safeFormString(formData, "bemerkung", 2000);
  if (!Number.isFinite(schuleId) || schuleId <= 0) return { error: "Ungueltige Schule." };
  if (!Number.isFinite(haushaltsjahrId) || haushaltsjahrId <= 0) return { error: "Ungueltiges Haushaltsjahr." };

  try {
    await upsertMehrarbeitSchuleBemerkung({
      schuleId,
      haushaltsjahrId,
      bemerkung,
      geaendertVon: session.name,
    });
    revalidatePath("/mehrarbeit");
    return { success: true };
  } catch (err) {
    console.error("saveMehrarbeitSchuleBemerkung:", err instanceof Error ? err.message : err);
    return { error: "Fehler beim Speichern." };
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
