/**
 * Authentifizierungs-Utilities.
 *
 * Passwort-Hashing mit bcryptjs (rein JavaScript, kein native Build noetig).
 * Benutzer-Lookup und Login-Timestamp.
 */

import bcrypt from "bcryptjs";
import { db } from "@/db";
import { benutzer } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBenutzerByEmail } from "@/lib/db/queries";

const SALT_ROUNDS = 12;

/**
 * Passwort hashen (fuer Benutzeranlage und Passwort-Aenderung).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Passwort gegen Hash pruefen (fuer Login).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Benutzer ueber E-Mail suchen.
 * Delegiert an die zentrale Query-Funktion (mit Normalisierung).
 */
export const findBenutzerByEmail = getBenutzerByEmail;

/**
 * Letzten Login-Zeitstempel aktualisieren.
 */
export async function updateLetzterLogin(benutzerId: number) {
  await db
    .update(benutzer)
    .set({ letzterLogin: new Date() })
    .where(eq(benutzer.id, benutzerId));
}
