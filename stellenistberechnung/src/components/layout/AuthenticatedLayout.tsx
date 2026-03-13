/**
 * Server Component: Zeigt Sidebar nur fuer eingeloggte Benutzer.
 *
 * Auf der Login-Seite wird kein Sidebar angezeigt.
 * Fuer eingeloggte Benutzer werden Session-Daten an Sidebar uebergeben.
 */

import { getOptionalSession } from "@/lib/auth/permissions";
import { Sidebar } from "./Sidebar";

export async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();

  // Nicht eingeloggt → kein Sidebar (Login-Seite)
  if (!session) {
    return <>{children}</>;
  }

  // Eingeloggt → Sidebar mit Benutzer-Infos
  return (
    <>
      <Sidebar
        userName={session.name}
        userRolle={session.rolle}
      />
      {children}
    </>
  );
}
