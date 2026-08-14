import { config } from "dotenv";
import path from "node:path";
import { createDb } from "./index.js";
import { runSeed } from "./seed/runSeed.js";
import { runAcceptance } from "./seed/accept.js";
import { monorepoRoot } from "./seed/paths.js";

config({ path: path.join(monorepoRoot, ".env") });

const { db, sqlite, path: dbPath } = createDb();
try {
  const result = runSeed(db, sqlite);
  console.log(`Seeded SQLite at ${dbPath}`);
  console.log(
    `Ingredients: ${result.ingredientCount}; IBA recipe entities: ${result.recipeCount}; pending mappings: ${result.pending.length}`,
  );
  console.log(
    `Pending list: ${path.join(monorepoRoot, "data/iba/pending/unmapped-ingredients.json")}`,
  );

  const accept = runAcceptance(db);
  for (const check of accept.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name} — ${check.detail}`);
  }
  if (!accept.ok) {
    process.exitCode = 1;
    console.error("Data acceptance failed (PRD §15).");
  } else {
    console.log("Data acceptance OK (PRD §15 data checks).");
  }
} finally {
  sqlite.close();
}
