"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import {
  createSchuljahr,
  updateSchuljahrAktiv,
  createHaushaltsjahr,
  updateHaushaltsjahrGesperrt,
  getHaushaltsjahrByJahr,
  createSchule,
  updateSchule,
  toggleSchuleAktiv,
  getSchuleBySchulnummer,
  getSchuleByKurzname,
} from "@/lib/db/queries";
import {
  schuljahrSchema,
  haushaltsjahrSchema,
  createSchuleSchema,
  updateSchuleSchema,
  safeFormNumber,
  safeFormString,
} from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

// ============================================================
// SCHULJAHRE
// ============================================================

export async function createSchuljahrAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = schuljahrSchema.safeParse({
    bezeichnung: safeFormString(formData, "bezeichnung", 20).trim(),
    startDatum: safeFormString(formData, "startDatum", 10),
    endDatum: safeFormString(formData, "endDatum", 10),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  try {
    const result = await createSchuljahr(data);

    await writeAuditLog("schuljahre", result.id, "INSERT", null, {
      bezeichnung: data.bezeichnung,
    }, session.name);

    revalidatePath("/einstellungen");
    revalidatePath("/slr-konfiguration");
    return { success: true, message: `Schuljahr "${data.bezeichnung}" wurde angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen des Schuljahrs:", err instanceof Error ? err.message : "Unbekannt");
    // Unique-Constraint pruefen
    if (err instanceof Error && err.message.includes("unique")) {
      return { error: `Schuljahr "${data.bezeichnung}" existiert bereits.` };
    }
    return { error: "Fehler beim Anlegen des Schuljahrs." };
  }
}

export async function toggleSchuljahrAktivAction(formData: FormData) {
  const session = await requireAdmin();

  const id = safeFormNumber(formData, "id");
  const aktiv = formData.get("aktiv") === "true";

  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await updateSchuljahrAktiv(id, aktiv);

    await writeAuditLog("schuljahre", id, "UPDATE", null, {
      aktiv,
      aktion: aktiv ? "aktiv_gesetzt" : "deaktiviert",
    }, session.name);

    revalidatePath("/einstellungen");
    revalidatePath("/slr-konfiguration");
    revalidatePath("/stellensoll");
    return { success: true, message: aktiv ? "Schuljahr als aktiv gesetzt." : "Schuljahr deaktiviert." };
  } catch (err: unknown) {
    console.error("Fehler:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}

// ============================================================
// HAUSHALTSJAHRE
// ============================================================

export async function createHaushaltsjahrAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = haushaltsjahrSchema.safeParse({
    jahr: safeFormNumber(formData, "jahr"),
    stichtagVorjahr: safeFormString(formData, "stichtagVorjahr", 10),
    stichtagLaufend: safeFormString(formData, "stichtagLaufend", 10),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Pruefen ob Haushaltsjahr schon existiert
  const existing = await getHaushaltsjahrByJahr(data.jahr);
  if (existing) {
    return { error: `Haushaltsjahr ${data.jahr} existiert bereits.` };
  }

  try {
    const result = await createHaushaltsjahr(data);

    await writeAuditLog("haushaltsjahre", result.id, "INSERT", null, {
      jahr: data.jahr,
    }, session.name);

    revalidatePath("/einstellungen");
    return { success: true, message: `Haushaltsjahr ${data.jahr} wurde angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen des Haushaltsjahrs:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Anlegen des Haushaltsjahrs." };
  }
}

export async function toggleHaushaltsjahrGesperrtAction(formData: FormData) {
  const session = await requireAdmin();

  const id = safeFormNumber(formData, "id");
  const gesperrt = formData.get("gesperrt") === "true";

  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await updateHaushaltsjahrGesperrt(id, gesperrt);

    await writeAuditLog("haushaltsjahre", id, "UPDATE", null, {
      gesperrt,
      aktion: gesperrt ? "gesperrt" : "entsperrt",
    }, session.name);

    revalidatePath("/einstellungen");
    return { success: true, message: gesperrt ? "Haushaltsjahr gesperrt." : "Haushaltsjahr entsperrt." };
  } catch (err: unknown) {
    console.error("Fehler:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}

// ============================================================
// SCHULEN
// ============================================================

export async function createSchuleAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = createSchuleSchema.safeParse({
    schulnummer: safeFormString(formData, "schulnummer", 10).trim(),
    name: safeFormString(formData, "name", 200).trim(),
    kurzname: safeFormString(formData, "kurzname", 10).trim(),
    schulform: safeFormString(formData, "schulform", 50).trim(),
    farbe: safeFormString(formData, "farbe", 7) || "#575756",
    untisCode: safeFormString(formData, "untisCode", 10).trim() || undefined,
    adresse: safeFormString(formData, "adresse", 300).trim() || undefined,
    plz: safeFormString(formData, "plz", 5).trim() || undefined,
    ort: safeFormString(formData, "ort", 100).trim() || undefined,
    istImAufbau: formData.get("istImAufbau") === "true",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Duplikat-Pruefung: Schulnummer
  const existingNummer = await getSchuleBySchulnummer(data.schulnummer);
  if (existingNummer) {
    return { error: `Schulnummer "${data.schulnummer}" ist bereits vergeben.` };
  }

  // Duplikat-Pruefung: Kurzname
  const existingKurz = await getSchuleByKurzname(data.kurzname);
  if (existingKurz) {
    return { error: `Kurzname "${data.kurzname}" ist bereits vergeben.` };
  }

  try {
    const result = await createSchule(data);

    await writeAuditLog("schulen", result.id, "INSERT", null, {
      schulnummer: data.schulnummer,
      kurzname: data.kurzname,
      name: data.name,
    }, session.name);

    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    return { success: true, message: `Schule "${data.kurzname}" wurde angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen der Schule:", err instanceof Error ? err.message : "Unbekannt");
    if (err instanceof Error && err.message.includes("unique")) {
      return { error: "Schule mit diesem Kurzname oder Schulnummer existiert bereits." };
    }
    return { error: "Fehler beim Anlegen der Schule." };
  }
}

export async function updateSchuleAction(formData: FormData) {
  const session = await requireAdmin();

  const id = safeFormNumber(formData, "id");

  const parsed = updateSchuleSchema.safeParse({
    id,
    schulnummer: safeFormString(formData, "schulnummer", 10).trim(),
    name: safeFormString(formData, "name", 200).trim(),
    kurzname: safeFormString(formData, "kurzname", 10).trim(),
    schulform: safeFormString(formData, "schulform", 50).trim(),
    farbe: safeFormString(formData, "farbe", 7) || "#575756",
    untisCode: safeFormString(formData, "untisCode", 10).trim() || undefined,
    adresse: safeFormString(formData, "adresse", 300).trim() || undefined,
    plz: safeFormString(formData, "plz", 5).trim() || undefined,
    ort: safeFormString(formData, "ort", 100).trim() || undefined,
    istImAufbau: formData.get("istImAufbau") === "true",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Duplikat-Pruefung: Schulnummer (bei anderem Datensatz)
  const existingNummer = await getSchuleBySchulnummer(data.schulnummer);
  if (existingNummer && existingNummer.id !== data.id) {
    return { error: `Schulnummer "${data.schulnummer}" ist bereits vergeben.` };
  }

  // Duplikat-Pruefung: Kurzname (bei anderem Datensatz)
  const existingKurz = await getSchuleByKurzname(data.kurzname);
  if (existingKurz && existingKurz.id !== data.id) {
    return { error: `Kurzname "${data.kurzname}" ist bereits vergeben.` };
  }

  try {
    const { id: schuleId, ...updateData } = data;
    await updateSchule(schuleId, updateData);

    await writeAuditLog("schulen", schuleId, "UPDATE", null, {
      schulnummer: data.schulnummer,
      kurzname: data.kurzname,
      name: data.name,
    }, session.name);

    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    return { success: true, message: `Schule "${data.kurzname}" wurde aktualisiert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aktualisieren der Schule:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aktualisieren der Schule." };
  }
}

export async function toggleSchuleAktivAction(formData: FormData) {
  const session = await requireAdmin();

  const id = safeFormNumber(formData, "id");
  const aktiv = formData.get("aktiv") === "true";

  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await toggleSchuleAktiv(id, aktiv);

    await writeAuditLog("schulen", id, "UPDATE", null, {
      aktiv,
      aktion: aktiv ? "aktiviert" : "deaktiviert",
    }, session.name);

    revalidatePath("/einstellungen");
    revalidatePath("/dashboard");
    return { success: true, message: aktiv ? "Schule aktiviert." : "Schule deaktiviert." };
  } catch (err: unknown) {
    console.error("Fehler:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}
