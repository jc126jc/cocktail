import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppDatabase } from "@cocktail/db";
import type Database from "better-sqlite3";
import {
  adminLoginBodySchema,
  createIngredientBodySchema,
  updateIngredientBodySchema,
  createRecipeBodySchema,
  createVersionBodySchema,
  ingredientIdBodySchema,
  publishRecipeBodySchema,
  recipeSearchQuerySchema,
  setPrimaryVersionBodySchema,
  staplePutBodySchema,
  updateRecipeBodySchema,
  updateTaxonomyBodySchema,
  type HealthResponse,
} from "@cocktail/shared";
import { eq } from "drizzle-orm";
import * as schema from "@cocktail/db/schema";
import { handleRoute, unauthorized } from "./http.js";
import {
  addInventory,
  addShopping,
  listInventory,
  listShopping,
  listStaples,
  purchaseItem,
  removeInventory,
  removeShopping,
  setStaple,
} from "./services/bar.js";
import {
  alcoholGroupsWithOwned,
  homeRecommendations,
  searchRecipes,
} from "./services/matching.js";
import {
  createIngredient,
  updateIngredient,
  createRecipe,
  createVersion,
  deleteIngredient,
  deleteRecipe,
  getAdminRecipe,
  getRecipeDetail,
  listIngredientsQuery,
  publishRecipe,
  setPrimaryVersion,
  updateRecipe,
} from "./services/admin.js";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  destroySessionToken,
  isValidSessionToken,
  passwordsMatch,
  resolveAdminPassword,
} from "./services/auth.js";
import { createOpenAiCompatibleProvider, type LlmProvider } from "./services/ai/provider.js";
import {
  commitAiImport,
  parseRecipeFromText,
  reparseRecipeFromText,
} from "./services/ai/import.js";
import { loadAiConfig } from "./services/ai/config.js";
import { runAiChat } from "./services/ai/chat.js";
import { createDbAiChatTools } from "./services/ai/chat-tools.js";
import {
  aiChatBodySchema,
  aiImportCommitBodySchema,
  aiImportParseBodySchema,
  aiImportReparseBodySchema,
} from "@cocktail/shared";

export type AppDeps = {
  db: AppDatabase;
  sqlite: Database.Database;
  /** Override admin password (tests). Defaults to env / cocktail-admin. */
  adminPassword?: string;
  /** Override LLM provider (tests). Defaults to SiliconFlow-compatible adapter. */
  llm?: LlmProvider;
};

export function createApp(deps?: AppDeps) {
  const app = new Hono();
  const adminPassword = resolveAdminPassword(deps?.adminPassword);
  const llm = deps?.llm ?? createOpenAiCompatibleProvider();

  const getDeps = (): AppDeps => {
    if (!deps) throw new Error("App deps not configured");
    return deps;
  };

  const isPublicAdminPath = (path: string, method: string) => {
    if (path === "/api/admin/login" && method === "POST") return true;
    if (path === "/api/admin/session" && method === "GET") return true;
    if (path === "/api/admin/logout" && method === "POST") return true;
    return false;
  };

  app.use("/api/admin/*", async (c, next) => {
    if (isPublicAdminPath(c.req.path, c.req.method)) {
      await next();
      return;
    }
    const token = getCookie(c, ADMIN_SESSION_COOKIE);
    if (!isValidSessionToken(token)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  app.post(
    "/api/admin/login",
    handleRoute(async (c) => {
      const body = adminLoginBodySchema.parse(await c.req.json());
      if (!passwordsMatch(adminPassword, body.password)) {
        throw unauthorized("Invalid password");
      }
      const token = createSessionToken();
      setCookie(c, ADMIN_SESSION_COOKIE, token, {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
      });
      return c.json({ ok: true, authenticated: true });
    }),
  );

  app.post(
    "/api/admin/logout",
    handleRoute((c) => {
      const token = getCookie(c, ADMIN_SESSION_COOKIE);
      destroySessionToken(token);
      setCookie(c, ADMIN_SESSION_COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
        sameSite: "Lax",
      });
      return c.json({ ok: true, authenticated: false });
    }),
  );

  app.get(
    "/api/admin/session",
    handleRoute((c) => {
      const token = getCookie(c, ADMIN_SESSION_COOKIE);
      return c.json({ authenticated: isValidSessionToken(token) });
    }),
  );

  app.get("/api/health", (c) => {
    const body: HealthResponse = { ok: true, service: "cocktail-api" };
    return c.json(body);
  });

  app.get(
    "/api/ai/status",
    handleRoute(() => {
      const configured = llm.isConfigured();
      return Response.json({
        configured,
        available: configured,
        model: configured ? loadAiConfig().model : null,
        provider: configured ? "openai-compatible" : null,
      });
    }),
  );

  app.post(
    "/api/ai/chat",
    handleRoute(async (c) => {
      const { db } = getDeps();
      const body = aiChatBodySchema.parse(await c.req.json());
      const result = await runAiChat({
        llm,
        tools: createDbAiChatTools(db),
        message: body.message,
        history: body.history,
      });
      return c.json(result);
    }),
  );

  app.post(
    "/api/admin/ai-import/parse",
    handleRoute(async (c) => {
      const { db } = getDeps();
      const body = aiImportParseBodySchema.parse(await c.req.json());
      const result = await parseRecipeFromText({
        llm,
        db,
        sourceText: body.sourceText,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
      });
      return c.json(result);
    }),
  );

  app.post(
    "/api/admin/ai-import/reparse",
    handleRoute(async (c) => {
      const { db } = getDeps();
      const body = aiImportReparseBodySchema.parse(await c.req.json());
      const result = await reparseRecipeFromText({
        llm,
        db,
        sourceText: body.sourceText,
        sourceName: body.sourceName,
        sourceUrl: body.sourceUrl,
        previous: body.previous,
        instruction: body.instruction,
      });
      return c.json(result);
    }),
  );

  app.post(
    "/api/admin/ai-import/commit",
    handleRoute(async (c) => {
      const { db, sqlite } = getDeps();
      const body = aiImportCommitBodySchema.parse(await c.req.json());
      const run = sqlite.transaction(() =>
        commitAiImport(db, {
          nameZh: body.nameZh,
          nameEn: body.nameEn,
          familyId: body.familyId,
          flavorTagIds: body.flavorTagIds,
          sourceName: body.sourceName,
          sourceUrl: body.sourceUrl,
          glassware: body.glassware,
          garnish: body.garnish,
          steps: body.steps,
          ingredients: body.ingredients,
        }),
      );
      return c.json(run());
    }),
  );

  app.get(
    "/api/alcohol-groups",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({ items: alcoholGroupsWithOwned(db) });
    }),
  );

  app.get(
    "/api/recipes/search",
    handleRoute((c) => {
      const { db } = getDeps();
      const query = recipeSearchQuerySchema.parse({
        q: c.req.query("q") ?? undefined,
        alcoholGroupIds: c.req.query("alcoholGroupIds"),
        familyIds: c.req.query("familyIds"),
        flavorIds: c.req.query("flavorIds"),
        sort: c.req.query("sort") ?? undefined,
        randomSeed: c.req.query("randomSeed"),
      });
      const result = searchRecipes(db, {
        q: query.q,
        alcoholGroupIds: query.alcoholGroupIds,
        familyIds: query.familyIds,
        flavorIds: query.flavorIds,
        sort: query.sort,
        randomSeed: query.randomSeed,
      });
      const families = db.select().from(schema.cocktailFamilies).all();
      const flavors = db.select().from(schema.flavorTags).all();
      const familyMap = new Map(families.map((f) => [f.id, f]));
      const flavorMap = new Map(flavors.map((f) => [f.id, f]));

      return c.json({
        items: result.items.map((row) => ({
          id: row.recipe.id,
          nameZh: row.recipe.nameZh,
          nameEn: row.recipe.nameEn,
          placeholderImageUrl: "/placeholder-cocktail.svg",
          family: familyMap.get(row.recipe.familyId) ?? null,
          flavors: row.recipe.flavorTagIds
            .map((id) => flavorMap.get(id))
            .filter(Boolean),
          missingCount: row.missingCount,
          materialStatus:
            row.missingCount === 0
              ? "complete"
              : row.missingCount === 1
                ? "missing_1"
                : "missing_2",
          recommended: row.recommended,
        })),
        recommendedIds: result.recommendedIds,
      });
    }),
  );

  app.get(
    "/api/recipes/:id",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json(getRecipeDetail(db, c.req.param("id")));
    }),
  );

  app.get(
    "/api/recommendations/home",
    handleRoute((c) => {
      const { db } = getDeps();
      const result = homeRecommendations(db);
      return c.json({
        items: result.items.map((row) => ({
          id: row.recipe.id,
          nameZh: row.recipe.nameZh,
          nameEn: row.recipe.nameEn,
          missingCount: row.missingCount,
          completenessKnown: row.completenessKnown,
          statusLabel: row.statusLabel,
          placeholderImageUrl: "/placeholder-cocktail.svg",
        })),
      });
    }),
  );

  app.get(
    "/api/inventory",
    handleRoute((c) => c.json(listInventory(getDeps().db))),
  );
  app.post(
    "/api/inventory",
    handleRoute(async (c) => {
      const body = ingredientIdBodySchema.parse(await c.req.json());
      return c.json(addInventory(getDeps().db, body.ingredientId));
    }),
  );
  app.delete(
    "/api/inventory/:ingredientId",
    handleRoute((c) =>
      c.json(removeInventory(getDeps().db, c.req.param("ingredientId"))),
    ),
  );

  app.get(
    "/api/staples",
    handleRoute((c) => c.json(listStaples(getDeps().db))),
  );
  app.put(
    "/api/staples/:ingredientId",
    handleRoute(async (c) => {
      const body = staplePutBodySchema.parse(await c.req.json());
      return c.json(
        setStaple(getDeps().db, c.req.param("ingredientId"), body.enabled),
      );
    }),
  );

  app.get(
    "/api/shopping-items",
    handleRoute((c) => c.json(listShopping(getDeps().db))),
  );
  app.post(
    "/api/shopping-items",
    handleRoute(async (c) => {
      const body = ingredientIdBodySchema.parse(await c.req.json());
      return c.json(addShopping(getDeps().db, body.ingredientId));
    }),
  );
  app.delete(
    "/api/shopping-items/:ingredientId",
    handleRoute((c) =>
      c.json(removeShopping(getDeps().db, c.req.param("ingredientId"))),
    ),
  );
  app.post(
    "/api/shopping-items/:ingredientId/purchase",
    handleRoute((c) => {
      const { db, sqlite } = getDeps();
      return c.json(purchaseItem(db, sqlite, c.req.param("ingredientId")));
    }),
  );

  app.get(
    "/api/ingredients",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json(
        listIngredientsQuery(db, {
          q: c.req.query("q") ?? undefined,
          categoryId: c.req.query("categoryId") ?? undefined,
        }),
      );
    }),
  );

  // --- admin ---
  app.get(
    "/api/admin/recipes",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({ items: db.select().from(schema.recipes).all() });
    }),
  );
  app.post(
    "/api/admin/recipes",
    handleRoute(async (c) => {
      const body = createRecipeBodySchema.parse(await c.req.json());
      return c.json(createRecipe(getDeps().db, body), 200);
    }),
  );
  app.get(
    "/api/admin/recipes/:id",
    handleRoute((c) => c.json(getAdminRecipe(getDeps().db, c.req.param("id")))),
  );
  app.patch(
    "/api/admin/recipes/:id",
    handleRoute(async (c) => {
      const body = updateRecipeBodySchema.parse(await c.req.json());
      return c.json(updateRecipe(getDeps().db, c.req.param("id"), body));
    }),
  );
  app.delete(
    "/api/admin/recipes/:id",
    handleRoute((c) =>
      c.json(deleteRecipe(getDeps().db, c.req.param("id"))),
    ),
  );
  app.post(
    "/api/admin/recipes/:id/publish",
    handleRoute(async (c) => {
      const body = publishRecipeBodySchema.parse(await c.req.json());
      return c.json(publishRecipe(getDeps().db, c.req.param("id"), body.status));
    }),
  );
  app.get(
    "/api/admin/alcohol-groups",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({
        items: db
          .select()
          .from(schema.alcoholGroups)
          .all()
          .sort((a, b) => a.sortOrder - b.sortOrder),
      });
    }),
  );
  app.put(
    "/api/admin/recipes/:id/primary-version",
    handleRoute(async (c) => {
      const body = setPrimaryVersionBodySchema.parse(await c.req.json());
      return c.json(
        setPrimaryVersion(getDeps().db, c.req.param("id"), body.versionId),
      );
    }),
  );
  app.post(
    "/api/admin/recipes/:id/versions",
    handleRoute(async (c) => {
      const body = createVersionBodySchema.parse(await c.req.json());
      return c.json(createVersion(getDeps().db, c.req.param("id"), body));
    }),
  );

  app.get(
    "/api/admin/ingredients",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({ items: db.select().from(schema.ingredients).all() });
    }),
  );
  app.post(
    "/api/admin/ingredients",
    handleRoute(async (c) => {
      const body = createIngredientBodySchema.parse(await c.req.json());
      return c.json(createIngredient(getDeps().db, body));
    }),
  );
  app.patch(
    "/api/admin/ingredients/:id",
    handleRoute(async (c) => {
      const body = updateIngredientBodySchema.parse(await c.req.json());
      return c.json(updateIngredient(getDeps().db, c.req.param("id"), body));
    }),
  );
  app.delete(
    "/api/admin/ingredients/:id",
    handleRoute((c) =>
      c.json(deleteIngredient(getDeps().db, c.req.param("id"))),
    ),
  );

  app.get(
    "/api/admin/families",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({ items: db.select().from(schema.cocktailFamilies).all() });
    }),
  );
  app.patch(
    "/api/admin/families/:id",
    handleRoute(async (c) => {
      const body = updateTaxonomyBodySchema.parse(await c.req.json());
      const { db } = getDeps();
      const id = c.req.param("id");
      const existing = db
        .select()
        .from(schema.cocktailFamilies)
        .where(eq(schema.cocktailFamilies.id, id))
        .get();
      if (!existing) return c.json({ error: "Not found" }, 404);
      db.update(schema.cocktailFamilies)
        .set({
          active: body.active === undefined ? existing.active : body.active ? 1 : 0,
          sortOrder: body.sortOrder ?? existing.sortOrder,
          nameZh: body.nameZh ?? existing.nameZh,
          nameEn: body.nameEn ?? existing.nameEn,
        })
        .where(eq(schema.cocktailFamilies.id, id))
        .run();
      return c.json({ ok: true });
    }),
  );

  app.get(
    "/api/admin/flavors",
    handleRoute((c) => {
      const { db } = getDeps();
      return c.json({ items: db.select().from(schema.flavorTags).all() });
    }),
  );
  app.patch(
    "/api/admin/flavors/:id",
    handleRoute(async (c) => {
      const body = updateTaxonomyBodySchema.parse(await c.req.json());
      const { db } = getDeps();
      const id = c.req.param("id");
      const existing = db
        .select()
        .from(schema.flavorTags)
        .where(eq(schema.flavorTags.id, id))
        .get();
      if (!existing) return c.json({ error: "Not found" }, 404);
      db.update(schema.flavorTags)
        .set({
          active: body.active === undefined ? existing.active : body.active ? 1 : 0,
          sortOrder: body.sortOrder ?? existing.sortOrder,
          nameZh: body.nameZh ?? existing.nameZh,
          nameEn: body.nameEn ?? existing.nameEn,
        })
        .where(eq(schema.flavorTags.id, id))
        .run();
      return c.json({ ok: true });
    }),
  );

  return app;
}
