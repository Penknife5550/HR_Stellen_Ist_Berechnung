/**
 * Rollen-Konstanten und -Helfer.
 *
 * Kann sowohl in Server- als auch Client-Komponenten verwendet werden.
 * Keine Server-Only-Imports (kein cookies(), kein redirect()).
 */

export type Rolle = "admin" | "mitarbeiter" | "betrachter";

export const ROLE_LEVEL: Record<Rolle, number> = {
  betrachter: 1,
  mitarbeiter: 2,
  admin: 3,
};

/**
 * Rollen-Label fuer die Anzeige.
 */
export function getRolleLabel(rolle: string): string {
  switch (rolle) {
    case "admin": return "Administrator";
    case "mitarbeiter": return "Mitarbeiter";
    case "betrachter": return "Betrachter";
    default: return rolle;
  }
}

/**
 * Badge-Farbe fuer Rollen-Anzeige.
 */
export function getRolleBadgeColor(rolle: string): string {
  switch (rolle) {
    case "admin": return "bg-purple-100 text-purple-800";
    case "mitarbeiter": return "bg-blue-100 text-blue-800";
    case "betrachter": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}
