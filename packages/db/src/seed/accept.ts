/**
 * PRD §15 data acceptance checks against local IBA corpus + SQLite.
 */
import { eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "../index.js";
import * as schema from "../schema.js";
import { readJson } from "./paths.js";
import type { RecipeSeed } from "./types.js";

export type AcceptResult = {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
};

export function runAcceptance(db: AppDatabase): AcceptResult {
  const recipes = readJson<RecipeSeed[]>("recipes/iba_recipes.json");
  const expectedIds = recipes
    .filter((r) => r.importKind === "new_recipe")
    .map((r) => r.id);
  const checks: AcceptResult["checks"] = [];

  const published = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.status, "published"))
    .all();

  const publishedIds = new Set(published.map((r) => r.id));
  const missing = expectedIds.filter((id) => !publishedIds.has(id));
  checks.push({
    name: "local IBA corpus fully published",
    ok: missing.length === 0,
    detail:
      missing.length === 0
        ? `${expectedIds.length} corpus recipes published`
        : `missing: ${missing.join(", ")}`,
  });

  const noPrimary = published.filter((r) => !r.primaryVersionId);
  checks.push({
    name: "every published recipe has a primary version",
    ok: noPrimary.length === 0,
    detail:
      noPrimary.length === 0
        ? "all have primary_version_id"
        : `missing primary: ${noPrimary.map((r) => r.id).join(", ")}`,
  });

  const primarySet = new Set(
    published.map((r) => r.primaryVersionId).filter(Boolean),
  );
  checks.push({
    name: "at most one primary per recipe (by FK pointer)",
    ok: primarySet.size === published.filter((r) => r.primaryVersionId).length,
    detail: `${primarySet.size} distinct primary versions for ${published.length} recipes`,
  });

  const withoutFamily = published.filter((r) => !r.familyId);
  const flavorCounts = db
    .select({
      recipeId: schema.recipeFlavorTags.recipeId,
      n: schema.recipeFlavorTags.flavorTagId,
    })
    .from(schema.recipeFlavorTags)
    .all();
  const flavorMap = new Map<string, number>();
  for (const row of flavorCounts) {
    flavorMap.set(row.recipeId, (flavorMap.get(row.recipeId) ?? 0) + 1);
  }
  const withoutFlavor = published.filter((r) => (flavorMap.get(r.id) ?? 0) < 1);
  checks.push({
    name: "family and ≥1 flavor on each published recipe",
    ok: withoutFamily.length === 0 && withoutFlavor.length === 0,
    detail:
      withoutFamily.length === 0 && withoutFlavor.length === 0
        ? "ok"
        : `no family: ${withoutFamily.map((r) => r.id).join(", ") || "—"}; no flavor: ${withoutFlavor.map((r) => r.id).join(", ") || "—"}`,
  });

  const orphanLines = db
    .select({ id: schema.recipeIngredients.id })
    .from(schema.recipeIngredients)
    .leftJoin(
      schema.ingredients,
      eq(schema.recipeIngredients.ingredientId, schema.ingredients.id),
    )
    .where(isNull(schema.ingredients.id))
    .all();
  checks.push({
    name: "published recipe ingredients reference valid Ingredient.id",
    ok: orphanLines.length === 0,
    detail:
      orphanLines.length === 0
        ? "all ingredient FKs valid"
        : `${orphanLines.length} orphan lines`,
  });

  const anyAmount = db.select().from(schema.recipeIngredients).all();
  const badAmount = anyAmount.filter(
    (row) => row.amountMl != null && typeof row.amountMl !== "number",
  );
  checks.push({
    name: "amounts stored as ml (amount_ml numeric or null)",
    ok: badAmount.length === 0,
    detail: `${anyAmount.filter((a) => a.amountMl != null).length} numeric ml values; nulls allowed for non-measured lines`,
  });

  const alcoholGroups = db.select().from(schema.alcoholGroups).all();
  checks.push({
    name: "nine homepage alcohol groups present",
    ok: alcoholGroups.length === 9,
    detail: `count=${alcoholGroups.length}`,
  });

  const baijiuRecipes = published.filter((r) =>
    (r.ibaCategory ?? "").toLowerCase().includes("baijiu"),
  );
  checks.push({
    name: "no auto-filled Chinese baijiu modern recipes",
    ok: baijiuRecipes.length === 0,
    detail:
      baijiuRecipes.length === 0
        ? "no baijiu filler recipes"
        : baijiuRecipes.map((r) => r.id).join(", "),
  });

  // Hierarchy: cointreau parent must be triple_sec (explicit decision)
  const cointreau = db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.id, "cointreau"))
    .get();
  checks.push({
    name: "explicit Cointreau→Triple Sec hierarchy link",
    ok: cointreau?.parentIngredientId === "triple_sec",
    detail: `cointreau.parent=${cointreau?.parentIngredientId ?? "missing"}`,
  });

  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
}
