/**
 * Authentifizierung eingehender Webhooks gegen `webhook_configs`.
 *
 * API-Keys werden nur als bcrypt-Hash gespeichert. Beim eingehenden Request
 * wird per Prefix-Index vorgefiltert, dann bcrypt-verglichen (async, damit
 * der Event-Loop nicht blockiert).
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const API_KEY_PREFIX = "whk_";
const KEY_BYTES = 32;
const BCRYPT_COST = 10;

/**
 * Generiert einen neuen API-Key im Format `whk_<hex>`.
 * Klartext wird nur einmal zurueckgegeben und ist danach nicht mehr einsehbar.
 */
export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const random = crypto.randomBytes(KEY_BYTES).toString("hex");
  const key = `${API_KEY_PREFIX}${random}`;
  const prefix = key.slice(0, 12);
  const hash = await bcrypt.hash(key, BCRYPT_COST);
  return { key, prefix, hash };
}

/**
 * Prueft einen eingehenden Klartext-Key gegen alle aktiven Configs des Typs.
 * Aktualisiert last_used_at bei Erfolg. Liefert {id, name} oder null.
 */
export async function authenticateWebhook(
  plainKey: string,
  endpointTyp: string
): Promise<{ id: number; name: string } | null> {
  if (!plainKey || !plainKey.startsWith(API_KEY_PREFIX)) return null;
  const prefix = plainKey.slice(0, 12);

  const candidates = await db
    .select()
    .from(schema.webhookConfigs)
    .where(
      and(
        eq(schema.webhookConfigs.aktiv, true),
        eq(schema.webhookConfigs.endpointTyp, endpointTyp),
        eq(schema.webhookConfigs.apiKeyPrefix, prefix)
      )
    );

  for (const c of candidates) {
    const match = await bcrypt.compare(plainKey, c.apiKeyHash);
    if (match) {
      await db
        .update(schema.webhookConfigs)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.webhookConfigs.id, c.id));
      return { id: c.id, name: c.name };
    }
  }
  return null;
}
