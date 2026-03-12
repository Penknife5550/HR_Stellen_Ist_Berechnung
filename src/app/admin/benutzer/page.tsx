/**
 * Benutzerverwaltung (Admin-Bereich).
 *
 * Nur fuer Admins zugaenglich (geprueft durch Middleware + requireAdmin).
 */

import { requireAdmin } from "@/lib/auth/permissions";
import { getAllBenutzer } from "@/lib/db/queries";
import { BenutzerVerwaltungClient } from "./BenutzerVerwaltungClient";

export const metadata = {
  title: "Benutzerverwaltung | CREDO Verwaltung",
};

export default async function BenutzerVerwaltungPage() {
  await requireAdmin();

  const benutzerList = await getAllBenutzer();

  return <BenutzerVerwaltungClient initialBenutzer={benutzerList} />;
}
