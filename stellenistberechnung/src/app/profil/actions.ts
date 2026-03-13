"use server";

import { requireAuth } from "@/lib/auth/permissions";
import { verifyPassword, hashPassword } from "@/lib/auth/auth";
import { getBenutzerById, updateBenutzerPasswort } from "@/lib/db/queries";
import { changePasswordSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

export async function changePasswordAction(formData: FormData) {
  const session = await requireAuth();

  const parsed = changePasswordSchema.safeParse({
    aktuellesPasswort: formData.get("aktuellesPasswort")?.toString() ?? "",
    neuesPasswort: formData.get("neuesPasswort")?.toString() ?? "",
    neuesPasswortBestaetigung: formData.get("neuesPasswortBestaetigung")?.toString() ?? "",
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabe.";
    return { error: firstError };
  }

  const data = parsed.data;

  // Aktuellen Benutzer mit Hash laden
  const user = await getBenutzerById(session.benutzerId);
  if (!user) {
    return { error: "Benutzer nicht gefunden." };
  }

  // Aktuelles Passwort pruefen
  const valid = await verifyPassword(data.aktuellesPasswort, user.passwortHash);
  if (!valid) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }

  // Neues Passwort darf nicht identisch zum alten sein
  if (data.aktuellesPasswort === data.neuesPasswort) {
    return { error: "Das neue Passwort muss sich vom aktuellen unterscheiden." };
  }

  try {
    const neuerHash = await hashPassword(data.neuesPasswort);
    await updateBenutzerPasswort(session.benutzerId, neuerHash);

    await writeAuditLog("benutzer", session.benutzerId, "UPDATE", null, {
      aktion: "passwort_geaendert",
    }, session.name);

    return { success: true, message: "Passwort wurde erfolgreich geaendert." };
  } catch (err: unknown) {
    console.error("Fehler beim Passwort-Aendern:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Passworts." };
  }
}
