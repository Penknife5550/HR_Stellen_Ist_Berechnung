/**
 * Profil-Seite: Kontoinformationen und Passwort aendern.
 * Fuer alle eingeloggten Benutzer zugaenglich.
 */

import { requireAuth } from "@/lib/auth/permissions";
import { ProfilClient } from "./ProfilClient";

export const metadata = {
  title: "Mein Profil | CREDO Verwaltung",
};

export default async function ProfilPage() {
  const session = await requireAuth();

  return (
    <ProfilClient
      userName={session.name}
      userEmail={session.email}
      userRolle={session.rolle}
    />
  );
}
