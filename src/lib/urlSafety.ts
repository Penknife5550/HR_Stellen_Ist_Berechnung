/**
 * SSRF-Schutz fuer ausgehende Webhook-URLs.
 *
 * Blockiert in Production:
 *  - Nicht-http(s)-Protokolle
 *  - Private / reservierte IP-Ranges (RFC1918, Loopback, Link-Local, CGNAT, ULA)
 *  - Cloud-Metadata-Adressen (169.254.169.254, fd00:ec2::254)
 *
 * In Development erlauben wir localhost/Private-IPs, damit lokale N8N-Instanzen
 * getestet werden koennen. Opt-Out via WEBHOOK_ALLOW_PRIVATE=0.
 */

import { promises as dns } from "dns";

export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const METADATA_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "fd00:ec2::254",
]);

function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;                            // 10.0.0.0/8
  if (a === 127) return true;                           // Loopback
  if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16/12
  if (a === 192 && b === 168) return true;              // 192.168/16
  if (a === 169 && b === 254) return true;              // Link-Local (inkl. Cloud-Metadata)
  if (a === 100 && b >= 64 && b <= 127) return true;    // CGNAT 100.64/10
  if (a === 0) return true;                             // 0.0.0.0/8
  if (a >= 224) return true;                            // Multicast/Reserviert
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;                     // Loopback
  if (lower.startsWith("fe80:")) return true;           // Link-Local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped — pruefe IPv4-Teil
    const v4 = lower.split(":").pop() ?? "";
    return isPrivateIPv4(v4);
  }
  return false;
}

function allowPrivateInDev(): boolean {
  // Opt-Out moeglich via ENV=0
  if (process.env.WEBHOOK_ALLOW_PRIVATE === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Prueft, ob eine URL fuer outgoing Webhooks zugelassen werden kann.
 */
export async function validateWebhookUrl(rawUrl: string): Promise<UrlCheck> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Ungueltige URL" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: `Protokoll ${parsed.protocol} nicht erlaubt` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) return { ok: false, reason: "Leerer Host" };

  if (METADATA_HOSTS.has(hostname)) {
    return { ok: false, reason: "Cloud-Metadata-Adresse blockiert" };
  }

  const allowPrivate = allowPrivateInDev();

  // Wenn Hostname direkt eine IP ist — pruefen
  const isLiteralIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  const isLiteralIPv6 = hostname.includes(":");
  if (isLiteralIPv4 || isLiteralIPv6) {
    const priv = isLiteralIPv4 ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
    if (priv && !allowPrivate) {
      return { ok: false, reason: "Private/reservierte IP blockiert" };
    }
    return { ok: true };
  }

  // DNS aufloesen und alle Adressen pruefen
  if (hostname === "localhost" && !allowPrivate) {
    return { ok: false, reason: "localhost in Production nicht erlaubt" };
  }

  if (!allowPrivate) {
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      for (const a of addrs) {
        const priv = a.family === 4 ? isPrivateIPv4(a.address) : isPrivateIPv6(a.address);
        if (priv) {
          return { ok: false, reason: `DNS ${hostname} zeigt auf private IP ${a.address}` };
        }
      }
    } catch (err) {
      return { ok: false, reason: `DNS-Aufloesung fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannt"}` };
    }
  }

  return { ok: true };
}
