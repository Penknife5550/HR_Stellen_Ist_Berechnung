/**
 * Session-Konfiguration mit iron-session.
 *
 * Verschluesselte Cookie-Sessions fuer die Stellenistberechnung.
 * Session-Daten liegen im Cookie (kein DB-Zugriff in Middleware noetig).
 */

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Rolle } from "./roles";

export type { Rolle };

export interface SessionData {
  benutzerId: number;
  email: string;
  name: string;
  rolle: Rolle;
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  benutzerId: 0,
  email: "",
  name: "",
  rolle: "betrachter",
  isLoggedIn: false,
};

// Startup-Check: SESSION_SECRET muss gesetzt und stark genug sein
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error(
    "SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen). " +
    "Bitte in .env setzen: SESSION_SECRET=$(openssl rand -base64 48)"
  );
}

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: "stellenist-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 Stunden (ein Arbeitstag)
    path: "/",
  },
};

/**
 * Session aus Cookies lesen/erstellen.
 * Fuer Server Components und Server Actions.
 */
export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}
