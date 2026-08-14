import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createDb } from "@cocktail/db";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
config({ path: path.join(repoRoot, ".env") });

const port = Number(process.env.PORT ?? 8787);
const { db, sqlite } = createDb();
const app = createApp({ db, sqlite });

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");

if (fs.existsSync(webDist)) {
  app.use(
    "/*",
    serveStatic({
      root: webDist,
      rewriteRequestPath: (p) => (p === "/" ? "/index.html" : p),
    }),
  );
}

console.log(`cocktail API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
