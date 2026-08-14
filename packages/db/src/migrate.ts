import { config } from "dotenv";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "./index.js";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

const { db, sqlite, path: dbPath } = createDb();
migrate(db, { migrationsFolder });
sqlite.close();

console.log(`Migrated SQLite at ${dbPath}`);
