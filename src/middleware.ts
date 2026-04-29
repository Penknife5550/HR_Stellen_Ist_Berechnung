/**
 * Next.js Middleware: Route-Schutz.
 *
 * Leitet nicht-authentifizierte Benutzer auf /login um.
 * Kein DB-Zugriff noetig (Session liegt im verschluesselten Cookie).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Login-Seite: immer erlaubt
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 2. n8n-API-Endpoints: eigene API-Key-Authentifizierung (kein Session-Schutz)
  //    - /api/deputate/sync       Lehrer-Deputate (v1, monatsbasiert)
  //    - /api/deputate/sync-v2    Lehrer-Deputate (v2, periodenbasiert)
  //    - /api/untis-terms/sync    Untis-Periodenmaster (v2-Voraussetzung)
  if (
    pathname.startsWith("/api/deputate/sync") ||
    pathname.startsWith("/api/untis-terms/sync")
  ) {
    return NextResponse.next();
  }

  // 3. Session pruefen
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Admin-Bereich: nur fuer Admins
  if (pathname.startsWith("/admin") && session.rolle !== "admin") {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Alle Routen ausser Next.js Internals und statische Dateien
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
