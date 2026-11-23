import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { axiomPool?: Pool };

/** One pool per server instance. Created lazily so builds do not need a database. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.axiomPool ??= new Pool({ connectionString: url, max: 5 });
  return drizzle(globalForDb.axiomPool, { schema });
}
