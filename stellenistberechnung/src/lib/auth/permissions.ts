/**
 * Berechtigungs-Helfer fuer Server Components und Server Actions.
 *
 * Rollen-Hierarchie: admin (3) > mitarbeiter (2) > betrachter (1)
 *
 * getRolleLabel, getRolleBadgeColor und ROLE_LEVEL liegen in roles.ts
 * (Client-kompatibel). Hier werden sie re-exportiert fuer Abwaertskompatibilitaet.
 */

import { getSession, type SessionData } from "./session";
import { redirect } from "next/navigation";
import { ROLE_LEVEL } from "./roles";
import type { Rolle } from "./roles";

// Re-Exports fuer bestehende Imports
export { getRolleLabel, getRolleBadgeColor, ROLE_LEVEL } from "./roles";

/**
 * Erfordert Authentifizierung.
 * Leitet auf /login um wenn nicht eingeloggt.
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }
  return session;
}

/**
 * Erfordert eine bestimmte Mindest-Rolle.
 */
export async function requireRole(minRole: Rolle): Promise<SessionData> {
  const session = await requireAuth();
  if (ROLE_LEVEL[session.rolle] < ROLE_LEVEL[minRole]) {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Erfordert Schreibberechtigung (Mitarbeiter oder Admin).
 * Betrachter werden auf /dashboard umgeleitet.
 */
export async function requireWriteAccess(): Promise<SessionData> {
  return requireRole("mitarbeiter");
}

/**
 * Erfordert Admin-Berechtigung.
 */
export async function requireAdmin(): Promise<SessionData> {
  return requireRole("admin");
}

/**
 * Optionale Session-Abfrage (gibt null zurueck wenn nicht eingeloggt).
 * Fuer Layout-Komponenten die bedingt rendern muessen.
 */
export async function getOptionalSession(): Promise<SessionData | null> {
  const session = await getSession();
  return session.isLoggedIn ? session : null;
}
