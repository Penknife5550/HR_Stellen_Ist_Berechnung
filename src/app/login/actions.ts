"use server";

import { getSession } from "@/lib/auth/session";
import { findBenutzerByEmail, verifyPassword, updateLetzterLogin } from "@/lib/auth/auth";
import { writeAuditLog } from "@/lib/audit";
import type { Rolle } from "@/lib/auth/session";

// ============================================================
// In-Memory Rate-Limiting (On-Premise, Single-Instance)
// ============================================================

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 Minuten

function checkRateLimit(email: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = loginAttempts.get(email);

  if (!record) return { allowed: true };

  // Fenster abgelaufen → zuruecksetzen
  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(email);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.firstAttempt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

function recordFailedAttempt(email: string) {
  const now = Date.now();
  const record = loginAttempts.get(email);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(email, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearAttempts(email: string) {
  loginAttempts.delete(email);
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================

export async function loginAction(formData: FormData) {
  const email = formData.get("email")?.toString()?.trim()?.toLowerCase();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  // Rate-Limit pruefen
  const rateCheck = checkRateLimit(email);
  if (!rateCheck.allowed) {
    const minuten = Math.ceil((rateCheck.retryAfterSec ?? 0) / 60);
    return {
      error: `Zu viele Anmeldeversuche. Bitte in ${minuten} Minute${minuten === 1 ? "" : "n"} erneut versuchen.`,
    };
  }

  // Benutzer suchen
  const user = await findBenutzerByEmail(email);
  if (!user || !user.aktiv) {
    recordFailedAttempt(email);
    // Einheitliche Fehlermeldung (verhindert User-Enumeration)
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  // Passwort pruefen
  const valid = await verifyPassword(password, user.passwortHash);
  if (!valid) {
    recordFailedAttempt(email);
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  // Erfolgreicher Login → Attempts zuruecksetzen
  clearAttempts(email);

  // Session erstellen
  const session = await getSession();
  session.benutzerId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.rolle = user.rolle as Rolle;
  session.isLoggedIn = true;
  await session.save();

  // Letzten Login aktualisieren
  await updateLetzterLogin(user.id);

  // Audit-Log
  await writeAuditLog("benutzer", user.id, "UPDATE", null, {
    aktion: "login",
  }, user.name);

  return { success: true };
}

export async function logoutAction() {
  const session = await getSession();
  const userName = session.name;
  const userId = session.benutzerId;

  session.destroy();

  if (userId) {
    await writeAuditLog("benutzer", userId, "UPDATE", null, {
      aktion: "logout",
    }, userName);
  }

  return { success: true };
}
