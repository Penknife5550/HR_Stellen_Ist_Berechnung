/**
 * Programmatischer Migration-Runner fuer Production.
 * Laeuft beim Container-Start VOR dem Next.js Server.
 *
 * Nutzt nur `postgres` (Production-Dependency, im Standalone-Build garantiert)
 * und Node.js Built-ins (fs, path). Kein drizzle-kit noetig.
 *
 * Kompatibel mit Drizzle-Migrations-Format (__drizzle_migrations Tabelle).
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

try {
  // Tracking-Tabelle erstellen (kompatibel mit Drizzle ORM Migrator)
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL UNIQUE,
      created_at bigint DEFAULT (extract(epoch from now()) * 1000)
    )
  `;

  // Journal lesen (enthaelt geordnete Liste aller Migrations)
  const migrationsDir = "./src/db/migrations";
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf-8")
  );

  let applied = 0;

  for (const entry of journal.entries) {
    const { tag } = entry;

    // Pruefen ob bereits ausgefuehrt
    const [existing] = await sql`
      SELECT id FROM "__drizzle_migrations" WHERE hash = ${tag}
    `;
    if (existing) {
      console.log(`  [skip] ${tag} (already applied)`);
      continue;
    }

    // Migration SQL lesen und an Breakpoints aufteilen
    const migrationSQL = readFileSync(
      join(migrationsDir, `${tag}.sql`),
      "utf-8"
    );
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // In Transaktion ausfuehren
    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`
        INSERT INTO "__drizzle_migrations" (hash) VALUES (${tag})
      `;
    });

    console.log(`  [done] ${tag}`);
    applied++;
  }

  if (applied === 0) {
    console.log("Database is up to date.");
  } else {
    console.log(`${applied} migration(s) applied successfully.`);
  }
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
