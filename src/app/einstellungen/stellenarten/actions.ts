"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createStellenartTyp, updateStellenartTyp } from "@/lib/db/queries";
import { stellenartTypCreateSchema } from "@/lib/validation";
import { safeFormString } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

// ============================================================
// STELLENART ERSTELLEN
// ============================================================

export async function createStellenartAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = stellenartTypCreateSchema.safeParse({
    bezeichnung: safeFormString(formData, "bezeichnung", 150).trim(),
    kurzbezeichnung: safeFormString(formData, "kurzbezeichnung", 30).trim() || undefined,
    beschreibung: safeFormString(formData, "beschreibung", 500).trim() || undefined,
    rechtsgrundlage: safeFormString(formData, "rechtsgrundlage", 300).trim() || undefined,
    bindungstyp: safeFormString(formData, "bindungstyp", 10),
    istIsoliert: formData.get("istIsoliert") === "true",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  try {
    const result = await createStellenartTyp(data);

    await writeAuditLog("stellenart_typen", result.id, "INSERT", null, {
      bezeichnung: data.bezeichnung,
      bindungstyp: data.bindungstyp,
    }, session.name);

    revalidatePath("/einstellungen/stellenarten");
    revalidatePath("/stellenanteile");
    return { success: true, message: `Stellenart "${data.bezeichnung}" wurde angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen der Stellenart:", err instanceof Error ? err.message : "Unbekannt");
    if (err instanceof Error && err.message.includes("unique")) {
      return { error: `Stellenart "${data.bezeichnung}" existiert bereits.` };
    }
    return { error: "Fehler beim Anlegen der Stellenart." };
  }
}

// ============================================================
// STELLENART AKTUALISIEREN
// ============================================================

export async function updateStellenartAction(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  const bezeichnung = safeFormString(formData, "bezeichnung", 150).trim();
  const kurzbezeichnung = safeFormString(formData, "kurzbezeichnung", 30).trim() || undefined;
  const beschreibung = safeFormString(formData, "beschreibung", 500).trim() || undefined;
  const rechtsgrundlage = safeFormString(formData, "rechtsgrundlage", 300).trim() || undefined;
  const bindungstyp = safeFormString(formData, "bindungstyp", 10);
  const istIsoliert = formData.get("istIsoliert") === "true";

  try {
    const result = await updateStellenartTyp(id, {
      bezeichnung,
      kurzbezeichnung: kurzbezeichnung ?? null,
      beschreibung: beschreibung ?? null,
      rechtsgrundlage: rechtsgrundlage ?? null,
      bindungstyp,
      istIsoliert,
    });

    await writeAuditLog("stellenart_typen", id, "UPDATE", null, {
      bezeichnung: result.bezeichnung,
      bindungstyp: result.bindungstyp,
    }, session.name);

    revalidatePath("/einstellungen/stellenarten");
    revalidatePath("/stellenanteile");
    return { success: true, message: `Stellenart "${result.bezeichnung}" wurde aktualisiert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aktualisieren der Stellenart:", err instanceof Error ? err.message : "Unbekannt");
    if (err instanceof Error && err.message.includes("unique")) {
      return { error: "Eine Stellenart mit dieser Bezeichnung existiert bereits." };
    }
    return { error: "Fehler beim Aktualisieren der Stellenart." };
  }
}

// ============================================================
// STELLENART AKTIV/INAKTIV TOGGLE
// ============================================================

export async function toggleStellenartAktivAction(formData: FormData) {
  const session = await requireAdmin();

  const id = Number(formData.get("id"));
  const aktiv = formData.get("aktiv") === "true";

  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  // Guard: "Sonstiger Stellenanteil" darf nicht deaktiviert werden
  if (!aktiv) {
    const bezeichnung = formData.get("bezeichnung");
    if (bezeichnung === "Sonstiger Stellenanteil") {
      return { error: '"Sonstiger Stellenanteil" kann nicht deaktiviert werden.' };
    }
  }

  try {
    await updateStellenartTyp(id, { aktiv });

    await writeAuditLog("stellenart_typen", id, "UPDATE", null, {
      aktiv,
      aktion: aktiv ? "aktiviert" : "deaktiviert",
    }, session.name);

    revalidatePath("/einstellungen/stellenarten");
    revalidatePath("/stellenanteile");
    return { success: true, message: aktiv ? "Stellenart aktiviert." : "Stellenart deaktiviert." };
  } catch (err: unknown) {
    console.error("Fehler:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}
