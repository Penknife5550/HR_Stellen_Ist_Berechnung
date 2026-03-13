"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/auth";
import {
  getAllBenutzer,
  getBenutzerByEmail,
  createBenutzer as createBenutzerQuery,
  updateBenutzer as updateBenutzerQuery,
  updateBenutzerPasswort,
} from "@/lib/db/queries";
import {
  createBenutzerSchema,
  updateBenutzerSchema,
  resetPasswordSchema,
  safeFormNumber,
  safeFormString,
} from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

export async function loadBenutzer() {
  await requireAdmin();
  return getAllBenutzer();
}

export async function createBenutzerAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = createBenutzerSchema.safeParse({
    email: safeFormString(formData, "email", 200).toLowerCase().trim(),
    name: safeFormString(formData, "name", 200).trim(),
    rolle: safeFormString(formData, "rolle", 20),
    passwort: safeFormString(formData, "passwort", 200),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Pruefen ob E-Mail bereits vergeben
  const existing = await getBenutzerByEmail(data.email);
  if (existing) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }

  try {
    const passwortHash = await hashPassword(data.passwort);
    const newUser = await createBenutzerQuery({
      email: data.email,
      passwortHash,
      name: data.name,
      rolle: data.rolle,
    });

    await writeAuditLog("benutzer", newUser.id, "INSERT", null, {
      email: data.email,
      name: data.name,
      rolle: data.rolle,
    }, session.name);

    revalidatePath("/admin/benutzer");
    return { success: true, message: `Benutzer "${data.name}" wurde angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Anlegen des Benutzers." };
  }
}

export async function updateBenutzerAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = updateBenutzerSchema.safeParse({
    id: safeFormNumber(formData, "id"),
    name: safeFormString(formData, "name", 200).trim(),
    email: safeFormString(formData, "email", 200).toLowerCase().trim(),
    rolle: safeFormString(formData, "rolle", 20),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Pruefen ob E-Mail bereits von einem anderen Benutzer genutzt wird
  const existing = await getBenutzerByEmail(data.email);
  if (existing && existing.id !== data.id) {
    return { error: "Diese E-Mail-Adresse ist bereits vergeben." };
  }

  try {
    await updateBenutzerQuery(data.id, {
      name: data.name,
      email: data.email,
      rolle: data.rolle,
    });

    await writeAuditLog("benutzer", data.id, "UPDATE", null, {
      name: data.name,
      email: data.email,
      rolle: data.rolle,
    }, session.name);

    revalidatePath("/admin/benutzer");
    return { success: true, message: `Benutzer "${data.name}" wurde aktualisiert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aktualisieren:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aktualisieren des Benutzers." };
  }
}

export async function toggleBenutzerAktivAction(formData: FormData) {
  const session = await requireAdmin();

  const id = safeFormNumber(formData, "id");
  const aktiv = formData.get("aktiv") === "true";

  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  // Admin kann sich nicht selbst deaktivieren
  if (id === session.benutzerId && !aktiv) {
    return { error: "Sie koennen sich nicht selbst deaktivieren." };
  }

  try {
    await updateBenutzerQuery(id, { aktiv });

    await writeAuditLog("benutzer", id, "UPDATE", null, {
      aktiv,
      aktion: aktiv ? "aktiviert" : "deaktiviert",
    }, session.name);

    revalidatePath("/admin/benutzer");
    return { success: true, message: aktiv ? "Benutzer aktiviert." : "Benutzer deaktiviert." };
  } catch (err: unknown) {
    console.error("Fehler beim Statusaendern:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}

export async function resetPasswordAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = resetPasswordSchema.safeParse({
    id: safeFormNumber(formData, "id"),
    neuesPasswort: safeFormString(formData, "neuesPasswort", 200),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  try {
    const passwortHash = await hashPassword(data.neuesPasswort);
    await updateBenutzerPasswort(data.id, passwortHash);

    await writeAuditLog("benutzer", data.id, "UPDATE", null, {
      aktion: "passwort_zurueckgesetzt",
    }, session.name);

    revalidatePath("/admin/benutzer");
    return { success: true, message: "Passwort wurde zurueckgesetzt." };
  } catch (err: unknown) {
    console.error("Fehler beim Passwort-Reset:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Zuruecksetzen des Passworts." };
  }
}
