import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Im Dev-Modus evaluiert Next.js dieses Modul bei jedem Hot-Reload neu; ohne Cache
// entsteht jedes Mal ein neuer Pool (postgres.js: 10 Verbindungen), bis Postgres
// "sorry, too many clients already" (53300) meldet. Deshalb den Client auf
// globalThis halten. In Production wird das Modul genau einmal geladen.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
