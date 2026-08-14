import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.resolve(packageRoot, "../..");

export function resolveDatabasePath(databaseUrl = process.env.DATABASE_URL): string {
  const configured = databaseUrl ?? path.join(monorepoRoot, "data", "app.sqlite");
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(monorepoRoot, configured);
}

export function createDb(databaseUrl?: string): {
  db: AppDatabase;
  sqlite: Database.Database;
  path: string;
} {
  const dbPath = resolveDatabasePath(databaseUrl);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite, path: dbPath };
}

export * from "./schema.js";
