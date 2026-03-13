import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Singleton-Pattern: Im Dev-Modus (HMR) wird bei jedem Hot-Reload eine neue
// Connection erstellt. Durch globalThis bleibt die Connection erhalten.
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client = globalForDb.pgClient ?? postgres(connectionString, {
  max: 10,              // Max. Connections im Pool
  idle_timeout: 20,     // Idle-Timeout in Sekunden
  connect_timeout: 10,  // Connect-Timeout in Sekunden
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
