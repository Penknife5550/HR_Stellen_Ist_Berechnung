"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { lehrer } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLehrerManuell, updateLehrerManuell, upsertManuellDeputat, getAktuellesHaushaltsjahr } from "@/lib/db/queries";
import { createLehrerManualSchema, safeFormNumber } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";

export async function createLehrerAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const raw = {
      vorname: formData.get("vorname")?.toString().trim() ?? "",
      nachname: formData.get("nachname")?.toString().trim() ?? "",
      personalnummer: formData.get("personalnummer")?.toString().trim() || undefined,
      stammschuleId: safeFormNumber(formData, "stammschuleId"),
      statistikCode: formData.get("statistikCode")?.toString().trim().toUpperCase() || "",
    };

    const parsed = createLehrerManualSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validierungsfehler.";
      return { error: firstError };
    }

    const result = await createLehrerManuell(parsed.data);

    // Deputat fuer alle 12 Monate anlegen wenn angegeben
    const deputatStr = formData.get("deputat")?.toString().replace(",", ".").trim() ?? "";
    const deputatVal = parseFloat(deputatStr);
    if (deputatStr && Number.isFinite(deputatVal) && deputatVal >= 0) {
      const hj = await getAktuellesHaushaltsjahr();
      if (hj) {
        await upsertManuellDeputat(result.id, hj.id, String(deputatVal));
      }
    }

    await writeAuditLog("lehrer", result.id, "INSERT", null, {
      vorname: parsed.data.vorname,
      nachname: parsed.data.nachname,
      personalnummer: parsed.data.personalnummer ?? null,
      stammschuleId: parsed.data.stammschuleId,
      statistikCode: parsed.data.statistikCode || null,
      deputat: deputatStr || null,
    }, session.name);

    revalidatePath("/mitarbeiter");
    revalidatePath("/deputate");
    revalidatePath("/stellenist");
    return { success: true, message: `Lehrkraft "${parsed.data.nachname} ${parsed.data.vorname}" angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen der Lehrkraft:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Anlegen der Lehrkraft." };
  }
}

export async function updateLehrerAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const id = safeFormNumber(formData, "id");
    if (!Number.isFinite(id) || id <= 0) {
      return { error: "Ungueltige Lehrer-ID." };
    }

    // Verify quelle="manuell"
    const [existing] = await db.select({ quelle: lehrer.quelle }).from(lehrer).where(eq(lehrer.id, id));
    if (!existing) return { error: "Lehrkraft nicht gefunden." };
    if (existing.quelle !== "manuell") return { error: "Nur manuell angelegte Lehrkraefte koennen bearbeitet werden." };

    const raw = {
      vorname: formData.get("vorname")?.toString().trim() ?? "",
      nachname: formData.get("nachname")?.toString().trim() ?? "",
      personalnummer: formData.get("personalnummer")?.toString().trim() || undefined,
      stammschuleId: safeFormNumber(formData, "stammschuleId"),
      statistikCode: formData.get("statistikCode")?.toString().trim().toUpperCase() || "",
    };

    const parsed = createLehrerManualSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Validierungsfehler.";
      return { error: firstError };
    }

    const result = await updateLehrerManuell(id, parsed.data);
    if (!result) return { error: "Lehrkraft konnte nicht aktualisiert werden." };

    // Deputat aktualisieren wenn angegeben
    const deputatStr = formData.get("deputat")?.toString().replace(",", ".").trim() ?? "";
    const deputatVal = parseFloat(deputatStr);
    if (deputatStr && Number.isFinite(deputatVal) && deputatVal >= 0) {
      const hj = await getAktuellesHaushaltsjahr();
      if (hj) {
        await upsertManuellDeputat(id, hj.id, String(deputatVal));
      }
    }

    await writeAuditLog("lehrer", id, "UPDATE", null, {
      vorname: parsed.data.vorname,
      nachname: parsed.data.nachname,
      personalnummer: parsed.data.personalnummer ?? null,
      stammschuleId: parsed.data.stammschuleId,
      statistikCode: parsed.data.statistikCode || null,
      deputat: deputatStr || null,
    }, session.name);

    revalidatePath("/mitarbeiter");
    revalidatePath("/deputate");
    revalidatePath("/stellenanteile");
    revalidatePath("/stellenist");
    return { success: true, message: `Lehrkraft "${parsed.data.nachname} ${parsed.data.vorname}" aktualisiert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aktualisieren der Lehrkraft:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aktualisieren der Lehrkraft." };
  }
}

export async function toggleLehrerAktivAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const id = safeFormNumber(formData, "id");
    const aktiv = formData.get("aktiv") === "true";

    if (!Number.isFinite(id) || id <= 0) {
      return { error: "Ungueltige Lehrer-ID." };
    }

    // Verify quelle="manuell"
    const [existing] = await db.select({ quelle: lehrer.quelle, vollname: lehrer.vollname }).from(lehrer).where(eq(lehrer.id, id));
    if (!existing) return { error: "Lehrkraft nicht gefunden." };
    if (existing.quelle !== "manuell") return { error: "Nur manuell angelegte Lehrkraefte koennen geaendert werden." };

    await db.update(lehrer).set({ aktiv }).where(and(eq(lehrer.id, id), eq(lehrer.quelle, "manuell")));

    await writeAuditLog("lehrer", id, "UPDATE", { aktiv: !aktiv }, { aktiv }, session.name);

    revalidatePath("/mitarbeiter");
    revalidatePath("/stellenanteile");
    return { success: true, message: `${existing.vollname} ist jetzt ${aktiv ? "aktiv" : "inaktiv"}.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aendern des Status:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}
