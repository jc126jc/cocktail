import type { AppDatabase } from "@cocktail/db";
import * as schema from "@cocktail/db/schema";
import {
  buildOwnedIds,
  buildSatisfiedIds,
  fillResults,
  markInListRecommendations,
  markOwnedAlcoholGroups,
  pickHomeRecommendations,
  scoreRecipe,
  sortRecipes,
  type IngredientNode,
  type RecipeInput,
  type SortMode,
} from "@cocktail/domain";
import { eq } from "drizzle-orm";
import type Database from "better-sqlite3";

export type DbDeps = { db: AppDatabase; sqlite: Database.Database };

export function loadIngredientNodes(
  db: AppDatabase,
): Record<string, IngredientNode> {
  const rows = db.select().from(schema.ingredients).all();
  const map: Record<string, IngredientNode> = {};
  for (const row of rows) {
    map[row.id] = {
      id: row.id,
      parentIngredientId: row.parentIngredientId,
      alcoholGroupId: row.alcoholGroupId,
    };
  }
  return map;
}

export function getOwnedState(db: AppDatabase) {
  const inventory = db.select().from(schema.inventoryItems).all();
  const staples = db.select().from(schema.stapleSettings).all();
  const ownedIds = buildOwnedIds({
    inventoryIngredientIds: inventory.map((i) => i.ingredientId),
    stapleSettings: staples.map((s) => ({
      ingredientId: s.ingredientId,
      enabled: s.enabled === 1,
    })),
  });
  const ingredients = loadIngredientNodes(db);
  const satisfiedIds = buildSatisfiedIds({ ownedIds, ingredients });
  return { ownedIds, satisfiedIds, ingredients, inventory, staples };
}

function resolveAlcoholGroupId(
  ingredientId: string,
  ingredients: Record<string, IngredientNode>,
): string | null {
  let current: string | null | undefined = ingredientId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const node = ingredients[current];
    if (!node) break;
    if (node.alcoholGroupId) return node.alcoholGroupId;
    current = node.parentIngredientId;
  }
  return null;
}

export function loadPublishedRecipeInputs(db: AppDatabase): RecipeInput[] {
  const ingredients = loadIngredientNodes(db);
  const published = db
    .select()
    .from(schema.recipes)
    .where(eq(schema.recipes.status, "published"))
    .all()
    .filter((r) => r.primaryVersionId);

  const flavorRows = db.select().from(schema.recipeFlavorTags).all();
  const flavorsByRecipe = new Map<string, string[]>();
  for (const row of flavorRows) {
    const list = flavorsByRecipe.get(row.recipeId) ?? [];
    list.push(row.flavorTagId);
    flavorsByRecipe.set(row.recipeId, list);
  }

  const result: RecipeInput[] = [];
  for (const recipe of published) {
    const versionId = recipe.primaryVersionId!;
    const lines = db
      .select()
      .from(schema.recipeIngredients)
      .where(eq(schema.recipeIngredients.recipeVersionId, versionId))
      .all();

    const alcoholGroupIds = new Set<string>();
    for (const line of lines) {
      const g = resolveAlcoholGroupId(line.ingredientId, ingredients);
      if (g) alcoholGroupIds.add(g);
    }

    result.push({
      id: recipe.id,
      nameZh: recipe.nameZh,
      nameEn: recipe.nameEn,
      familyId: recipe.familyId,
      flavorTagIds: flavorsByRecipe.get(recipe.id) ?? [],
      alcoholGroupIds: [...alcoholGroupIds],
      demands: lines.map((l) => ({
        ingredientId: l.ingredientId,
        role: l.role as "required" | "optional" | "garnish" | "either",
        eitherGroupId: l.eitherGroupId,
      })),
      editorRecommended: recipe.editorRecommended === 1,
      recommendationOrder: recipe.recommendationOrder,
    });
  }
  return result;
}

export function searchRecipes(
  db: AppDatabase,
  query: {
    q?: string;
    alcoholGroupIds: string[];
    familyIds: string[];
    flavorIds: string[];
    sort: SortMode;
    randomSeed?: string;
    /** Result fill size; homepage default 12. AI chat uses 6 with hardCap. */
    fillTarget?: number;
    hardCap?: boolean;
  },
) {
  const { satisfiedIds } = getOwnedState(db);
  const recipes = loadPublishedRecipeInputs(db);
  const scored = recipes.map((recipe) =>
    scoreRecipe({
      recipe,
      selectedAlcoholGroupIds: query.alcoholGroupIds,
      familyIds: query.familyIds,
      flavorIds: query.flavorIds,
      nameQuery: query.q,
      satisfiedIds,
    }),
  );
  const filled = fillResults(scored.filter((s) => s.eligible), {
    target: query.fillTarget,
    hardCap: query.hardCap,
  });
  const sorted = sortRecipes(filled, {
    sort: query.sort,
    randomSeed: query.randomSeed,
  });
  const marked = markInListRecommendations(sorted);
  return {
    items: marked,
    recommendedIds: marked.filter((m) => m.recommended).map((m) => m.recipe.id),
  };
}

export function homeRecommendations(db: AppDatabase) {
  const { ownedIds, satisfiedIds, inventory, staples } = getOwnedState(db);
  const barIsEmpty = inventory.length === 0 && !staples.some((s) => s.enabled === 1);
  const recipes = loadPublishedRecipeInputs(db).filter(
    (r) => r.editorRecommended,
  );
  const scored = recipes.map((recipe) =>
    scoreRecipe({
      recipe,
      selectedAlcoholGroupIds: [],
      familyIds: [],
      flavorIds: [],
      satisfiedIds: barIsEmpty ? new Set() : satisfiedIds,
    }),
  );
  // When bar empty, still pick from recommended pool using missing counts as unknown
  const picked = pickHomeRecommendations({
    candidates: scored.map((s) =>
      barIsEmpty ? { ...s, missingCount: 0, eligible: true } : s,
    ),
    barIsEmpty,
  });
  return { items: picked, ownedCount: ownedIds.size };
}

export function alcoholGroupsWithOwned(db: AppDatabase) {
  const groups = db
    .select()
    .from(schema.alcoholGroups)
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const { ownedIds, ingredients } = getOwnedState(db);
  const marks = markOwnedAlcoholGroups({
    ownedIds,
    ingredients,
    alcoholGroupIds: groups.map((g) => g.id),
  });
  const markMap = new Map(marks.map((m) => [m.id, m.owned]));
  // marks already sorted owned-first; preserve that order for response
  return marks.map((m) => {
    const g = groups.find((x) => x.id === m.id)!;
    return {
      id: g.id,
      nameZh: g.nameZh,
      nameEn: g.nameEn,
      sortOrder: g.sortOrder,
      owned: markMap.get(g.id) ?? false,
    };
  });
}
