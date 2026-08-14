import { config } from "dotenv";
import path from "node:path";
import { createDb } from "./index.js";
import { runAcceptance } from "./seed/accept.js";
import { monorepoRoot } from "./seed/paths.js";

config({ path: path.join(monorepoRoot, ".env") });

const { db, sqlite } = createDb();
try {
  const accept = runAcceptance(db);
  for (const check of accept.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name} — ${check.detail}`);
  }
  if (!accept.ok) {
    process.exitCode = 1;
  }
} finally {
  sqlite.close();
}
