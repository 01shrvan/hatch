import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function createDb() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 3 });
  return drizzle(client, { schema });
}

export const db = globalThis.__db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
}
