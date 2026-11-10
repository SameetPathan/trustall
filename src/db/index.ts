import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { requireEnv } from "@/lib/env";

type Db = NodePgDatabase<typeof schema>;
const globalForDb = globalThis as unknown as { __trustallPool?: Pool; __trustallDb?: Db };

/** Lazy so that importing this module never needs DATABASE_URL (for example during build). */
export function getDb(): Db {
  if (!globalForDb.__trustallDb) {
    const pool = new Pool({ connectionString: requireEnv("DATABASE_URL"), max: 5 });
    globalForDb.__trustallPool = pool;
    globalForDb.__trustallDb = drizzle(pool, { schema });
  }
  return globalForDb.__trustallDb;
}

export { schema };
